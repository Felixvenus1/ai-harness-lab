"""Purpose: Execute a FlowGraph with async parallel branches, conditional routing, and loop iteration."""
from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from harness_core.node_types import NodeType
from harness_core.schemas import (
    ConnectorConfig,
    ExecutionResult,
    ExecutionTrace,
    FlowGraph,
    FlowNode,
)

from app.providers.mock_provider import ProviderTimeoutError
from app.providers.registry import get_provider

if TYPE_CHECKING:
    from app.observability.collector import TraceCollector

from app.observability.models import SpanKind, SpanStatus

_NODE_SPAN_KIND: dict[NodeType, SpanKind] = {
    NodeType.INPUT_VALIDATOR: SpanKind.VALIDATION,
    NodeType.NORMALISER: SpanKind.GENERAL,
    NodeType.MODEL: SpanKind.MODEL_CALL,
    NodeType.SCHEMA_VALIDATOR: SpanKind.VALIDATION,
    NodeType.FALLBACK: SpanKind.FALLBACK,
    NodeType.LOGGER: SpanKind.GENERAL,
    NodeType.ROUTER: SpanKind.GENERAL,
    NodeType.MERGE: SpanKind.GENERAL,
    NodeType.LOOP: SpanKind.RETRY,
}

_UNSAFE_MARKERS = ("dangerous weapon", "build a bomb", "make a weapon")


class FlowExecutionError(Exception):
    """Raised when a flow cannot be executed (e.g. a cycle or missing node)."""


@dataclass
class _NodeResult:
    node: FlowNode
    node_input: Any
    output: Any
    passed: bool
    error: str | None
    duration_ms: float
    started_at: datetime
    ended_at: datetime
    span_status: SpanStatus


def _ensure_edge_ids(edges: list[ConnectorConfig]) -> list[ConnectorConfig]:
    return [e if e.id else e.model_copy(update={"id": str(uuid4())}) for e in edges]


def _topological_order(graph: FlowGraph) -> list[FlowNode]:
    """Kahn's algorithm — rejects true cycles (loop semantics handled separately)."""
    nodes_by_id = {n.id: n for n in graph.nodes}
    indegree = {n.id: 0 for n in graph.nodes}
    adjacency: dict[str, list[str]] = {n.id: [] for n in graph.nodes}

    for edge in graph.edges:
        if edge.source not in nodes_by_id or edge.target not in nodes_by_id:
            raise FlowExecutionError(
                f"edge references unknown node: {edge.source} -> {edge.target}"
            )
        adjacency[edge.source].append(edge.target)
        indegree[edge.target] += 1

    ready = [n for n in graph.nodes if indegree[n.id] == 0]
    ordered: list[FlowNode] = []
    while ready:
        node = ready.pop(0)
        ordered.append(node)
        for tid in adjacency[node.id]:
            indegree[tid] -= 1
            if indegree[tid] == 0:
                ready.append(nodes_by_id[tid])

    if len(ordered) != len(graph.nodes):
        raise FlowExecutionError("flow graph contains a cycle")
    return ordered


def _compute_levels(
    ordered: list[FlowNode],
    incoming: dict[str, list[ConnectorConfig]],
) -> list[list[FlowNode]]:
    """Group nodes into topological levels — nodes at the same level have no intra-level deps."""
    level_map: dict[str, int] = {}
    for node in ordered:
        if not incoming[node.id]:
            level_map[node.id] = 0
        else:
            level_map[node.id] = 1 + max(level_map.get(e.source, 0) for e in incoming[node.id])

    if not level_map:
        return []
    max_lv = max(level_map.values())
    levels: list[list[FlowNode]] = [[] for _ in range(max_lv + 1)]
    for node in ordered:
        levels[level_map[node.id]].append(node)
    return levels


def _evaluate_condition(condition: str, output: Any, passed: bool) -> bool:
    try:
        ctx: dict[str, Any] = {
            "passed": passed, "output": output,
            "True": True, "False": False, "true": True, "false": False, "None": None,
        }
        return bool(eval(condition, {"__builtins__": {}}, ctx))  # noqa: S307
    except Exception:
        return False


def _resolve_router_handle(node: FlowNode, output: Any, passed: bool) -> str:
    for route in (node.config.routes or []):
        if route.get("expression") and _evaluate_condition(route["expression"], output, passed):
            return route.get("source_handle", "default")
    return "default"


def _get_node_input(
    node: FlowNode,
    incoming: dict[str, list[ConnectorConfig]],
    active_edge_ids: set[str],
    node_outputs: dict[str, Any],
    node_passed: dict[str, bool],
    initial_input: Any,
) -> tuple[Any, bool]:
    """Return (input_value, prev_passed) for a node based on its active incoming edges."""
    my_incoming = incoming[node.id]
    if not my_incoming:
        return initial_input, True

    active = [e for e in my_incoming if e.id in active_edge_ids]
    if not active:
        return initial_input, True  # entry fallback (shouldn't happen after reachability check)

    if node.type == NodeType.MERGE:
        strategy = node.config.merge_strategy
        upstream = [node_outputs[e.source] for e in active if e.source in node_outputs]
        val = upstream[0] if strategy == "first_wins" and upstream else upstream
        prev = all(node_passed.get(e.source, True) for e in active)
        return val, prev

    src = active[0]
    return node_outputs.get(src.source, initial_input), node_passed.get(src.source, True)


def _activate_outgoing(
    node: FlowNode,
    output: Any,
    passed: bool,
    outgoing: dict[str, list[ConnectorConfig]],
    active_edge_ids: set[str],
) -> None:
    if node.type == NodeType.ROUTER:
        active_handle = _resolve_router_handle(node, output, passed)
        for edge in outgoing[node.id]:
            rule = edge.policy.routing_rule
            if rule == "always":
                active_edge_ids.add(edge.id)
            elif rule == "on_condition" and edge.source_handle == active_handle:
                active_edge_ids.add(edge.id)
    else:
        for edge in outgoing[node.id]:
            rule = edge.policy.routing_rule
            if rule == "always":
                active_edge_ids.add(edge.id)
            elif rule == "on_success" and passed:
                active_edge_ids.add(edge.id)
            elif rule == "on_failure" and not passed:
                active_edge_ids.add(edge.id)
            elif rule == "on_condition" and edge.policy.condition:
                if _evaluate_condition(edge.policy.condition, output, passed):
                    active_edge_ids.add(edge.id)


class FlowExecutor:
    """Async executor: parallel branches at each topological level, loop body re-iteration."""

    def __init__(self, graph: FlowGraph, collector: "TraceCollector | None" = None) -> None:
        self.graph = graph
        self.collector = collector

    async def run(self) -> ExecutionTrace:  # noqa: PLR0912, PLR0915
        edges = _ensure_edge_ids(self.graph.edges)

        nodes_by_id = {n.id: n for n in self.graph.nodes}
        incoming: dict[str, list[ConnectorConfig]] = {n.id: [] for n in self.graph.nodes}
        outgoing: dict[str, list[ConnectorConfig]] = {n.id: [] for n in self.graph.nodes}
        for edge in edges:
            if edge.source in nodes_by_id and edge.target in nodes_by_id:
                incoming[edge.target].append(edge)
                outgoing[edge.source].append(edge)

        ordered = _topological_order(self.graph)
        levels = _compute_levels(ordered, incoming)

        node_outputs: dict[str, Any] = {}
        node_passed: dict[str, bool] = {}
        active_edge_ids: set[str] = set()
        results: list[ExecutionResult] = []
        total_ms = 0.0

        for level_nodes in levels:
            # Split into nodes that should execute this round
            executable = [
                n for n in level_nodes
                if not incoming[n.id]  # entry node
                or any(e.id in active_edge_ids for e in incoming[n.id])
            ]
            if not executable:
                continue

            regular = [n for n in executable if n.type != NodeType.LOOP]
            loop_nodes = [n for n in executable if n.type == NodeType.LOOP]

            # ── Parallel execution for regular nodes ────────────────────────
            if regular:
                inputs = {
                    n.id: _get_node_input(n, incoming, active_edge_ids, node_outputs, node_passed, self.graph.initial_input)
                    for n in regular
                }
                batch = await asyncio.gather(
                    *[self._exec_node(n, *inputs[n.id]) for n in regular],
                    return_exceptions=True,
                )
                for node, res in zip(regular, batch):
                    if isinstance(res, BaseException):
                        res = _NodeResult(
                            node=node, node_input=inputs[node.id][0],
                            output=inputs[node.id][0], passed=False,
                            error=str(res), duration_ms=0.0,
                            started_at=datetime.now(timezone.utc),
                            ended_at=datetime.now(timezone.utc),
                            span_status=SpanStatus.FAILURE,
                        )
                    total_ms += res.duration_ms
                    node_outputs[node.id] = res.output
                    node_passed[node.id] = res.passed
                    results.append(ExecutionResult(
                        node_id=node.id, node_type=node.type,
                        input=res.node_input, output=res.output,
                        passed=res.passed, error=res.error,
                        duration_ms=round(res.duration_ms, 3),
                    ))
                    _activate_outgoing(node, res.output, res.passed, outgoing, active_edge_ids)
                    self._emit_span(res)
                    self._emit_connector_spans(node, res.node_input, incoming, active_edge_ids)

            # ── Loop nodes: sequential, with body iteration ─────────────────
            for loop_node in loop_nodes:
                node_input, prev_passed = _get_node_input(
                    loop_node, incoming, active_edge_ids, node_outputs, node_passed, self.graph.initial_input
                )
                res = await self._exec_node(loop_node, node_input, prev_passed)
                total_ms += res.duration_ms
                node_outputs[loop_node.id] = res.output
                node_passed[loop_node.id] = res.passed
                results.append(ExecutionResult(
                    node_id=loop_node.id, node_type=loop_node.type,
                    input=res.node_input, output=res.output,
                    passed=res.passed, error=res.error,
                    duration_ms=round(res.duration_ms, 3),
                ))
                self._emit_span(res)

                # Execute additional loop iterations
                loop_out, loop_passed, iter_ms = await self._run_loop_iterations(
                    loop_node, ordered, incoming, active_edge_ids,
                    node_outputs, node_passed, results,
                )
                total_ms += iter_ms
                node_outputs[loop_node.id] = loop_out
                node_passed[loop_node.id] = loop_passed

                _activate_outgoing(loop_node, loop_out, loop_passed, outgoing, active_edge_ids)
                self._emit_connector_spans(loop_node, node_input, incoming, active_edge_ids)

        final_output: Any = self.graph.initial_input
        for node in ordered:
            if node.id in node_outputs:
                final_output = node_outputs[node.id]

        return ExecutionTrace(
            passed=all(r.passed for r in results),
            final_output=final_output,
            results=results,
            total_duration_ms=round(total_ms, 3),
        )

    # ── Core node execution ─────────────────────────────────────────────────

    async def _exec_node(self, node: FlowNode, value: Any, prev_passed: bool) -> _NodeResult:
        """Run one node and return a fully populated result record."""
        started_at = datetime.now(timezone.utc)
        t0 = time.perf_counter()
        try:
            output, passed = await self._dispatch(node, value, prev_passed)
            error = None
            status = SpanStatus.SUCCESS if passed else SpanStatus.FAILURE
        except Exception as exc:  # noqa: BLE001
            output, passed, error = value, False, str(exc)
            status = SpanStatus.FAILURE
        duration_ms = (time.perf_counter() - t0) * 1000.0
        return _NodeResult(
            node=node, node_input=value, output=output, passed=passed,
            error=error, duration_ms=duration_ms,
            started_at=started_at, ended_at=datetime.now(timezone.utc),
            span_status=status,
        )

    async def _dispatch(self, node: FlowNode, value: Any, prev_passed: bool) -> tuple[Any, bool]:
        if node.type == NodeType.INPUT_VALIDATOR:
            return self._input_validator(node, value)
        if node.type == NodeType.NORMALISER:
            return self._normaliser(node, value)
        if node.type == NodeType.MODEL:
            return await self._model(node, value)
        if node.type == NodeType.SCHEMA_VALIDATOR:
            return self._schema_validator(node, value)
        if node.type == NodeType.FALLBACK:
            return self._fallback(node, value, prev_passed)
        if node.type == NodeType.LOGGER:
            return self._logger(node, value)
        if node.type in (NodeType.ROUTER, NodeType.MERGE, NodeType.LOOP):
            return value, True  # pass-through; routing/merging handled by run()
        return value, True

    # ── Loop body re-execution ──────────────────────────────────────────────

    async def _run_loop_iterations(
        self,
        loop_node: FlowNode,
        ordered: list[FlowNode],
        incoming: dict[str, list[ConnectorConfig]],
        active_edge_ids: set[str],
        node_outputs: dict[str, Any],
        node_passed: dict[str, bool],
        results: list[ExecutionResult],
    ) -> tuple[Any, bool, float]:
        """Re-execute the loop body up to max_iterations until exit_condition is met."""
        loop_target_id = loop_node.config.loop_target
        max_iter = max(1, loop_node.config.max_iterations or 3)
        exit_cond = loop_node.config.exit_condition

        current = node_outputs.get(loop_node.id, self.graph.initial_input)
        passed = node_passed.get(loop_node.id, True)
        total_ms = 0.0

        if not loop_target_id:
            return current, passed, total_ms

        # Extract body: nodes from loop_target (inclusive) up to (not including) loop_node
        body_nodes: list[FlowNode] = []
        capturing = False
        for n in ordered:
            if n.id == loop_target_id:
                capturing = True
            if n.id == loop_node.id:
                break
            if capturing:
                body_nodes.append(n)

        if not body_nodes:
            return current, passed, total_ms

        # Check if already satisfied after the initial (iteration 0) run
        if exit_cond and _evaluate_condition(exit_cond, current, passed):
            return current, passed, total_ms

        # Iterations 1 … max_iter-1
        for iteration in range(1, max_iter):
            body_input = current
            body_passed = passed

            for body_node in body_nodes:
                res = await self._exec_node(body_node, body_input, body_passed)
                total_ms += res.duration_ms
                node_outputs[body_node.id] = res.output
                node_passed[body_node.id] = res.passed
                results.append(ExecutionResult(
                    node_id=body_node.id,
                    node_type=body_node.type,
                    input=res.node_input,
                    output=res.output,
                    passed=res.passed,
                    error=res.error,
                    duration_ms=round(res.duration_ms, 3),
                ))
                if self.collector:
                    kind = _NODE_SPAN_KIND.get(body_node.type, SpanKind.GENERAL)
                    self.collector.add_span(
                        kind=kind,
                        name=f"{body_node.type.value}:{body_node.id}[loop:{iteration}]",
                        started_at=res.started_at,
                        ended_at=res.ended_at,
                        input=res.node_input,
                        output=res.output,
                        status=res.span_status,
                        error=res.error,
                        metadata={"loop_iteration": iteration},
                    )
                body_input = res.output
                body_passed = res.passed

            current = body_input
            passed = body_passed

            if exit_cond and _evaluate_condition(exit_cond, current, passed):
                break

        return current, passed, total_ms

    # ── Observability helpers ───────────────────────────────────────────────

    def _emit_span(self, res: _NodeResult) -> None:
        if self.collector is None:
            return
        kind = _NODE_SPAN_KIND.get(res.node.type, SpanKind.GENERAL)
        self.collector.add_span(
            kind=kind,
            name=f"{res.node.type.value}:{res.node.id}",
            started_at=res.started_at,
            ended_at=res.ended_at,
            input=res.node_input,
            output=res.output,
            status=res.span_status,
            error=res.error,
        )

    def _emit_connector_spans(
        self,
        node: FlowNode,
        node_input: Any,
        incoming: dict[str, list[ConnectorConfig]],
        active_edge_ids: set[str],
    ) -> None:
        if self.collector is None:
            return
        for edge in incoming[node.id]:
            if edge.id in active_edge_ids and edge.policy.log_on_traverse:
                now = datetime.now(timezone.utc)
                self.collector.add_span(
                    kind=SpanKind.GENERAL,
                    name=f"connector:{edge.id}",
                    started_at=now,
                    ended_at=now,
                    input=node_input,
                    output=None,
                    status=SpanStatus.SUCCESS,
                    metadata={
                        "source": edge.source,
                        "target": edge.target,
                        "routing_rule": edge.policy.routing_rule,
                        "label": edge.label,
                    },
                )

    # ── Node handlers ───────────────────────────────────────────────────────

    @staticmethod
    def _input_validator(node: FlowNode, value: Any) -> tuple[Any, bool]:
        cfg = node.config
        text = "" if value is None else str(value)
        if cfg.required and not text.strip():
            return text, False
        if cfg.min_length is not None and len(text) < cfg.min_length:
            return text, False
        if cfg.max_length is not None and len(text) > cfg.max_length:
            return text, False
        return text, True

    @staticmethod
    def _normaliser(node: FlowNode, value: Any) -> tuple[Any, bool]:
        cfg = node.config
        text = "" if value is None else str(value)
        if cfg.strip:
            text = text.strip()
        if cfg.lowercase:
            text = text.lower()
        if cfg.template:
            text = cfg.template.replace("{input}", text)
        return text, True

    @staticmethod
    async def _model(node: FlowNode, value: Any) -> tuple[Any, bool]:
        cfg = node.config
        provider = get_provider(cfg.provider, model=cfg.model or None)
        if hasattr(provider, "mode"):
            provider.mode = cfg.response_mode

        messages: list[dict[str, str]] = []
        if cfg.system_prompt:
            messages.append({"role": "system", "content": cfg.system_prompt})
        messages.append({"role": "user", "content": "" if value is None else str(value)})

        try:
            # Run sync provider in a thread so other branches can proceed concurrently.
            output = await asyncio.to_thread(provider.complete, messages)
        except ProviderTimeoutError as exc:
            return f"<timeout: {exc}>", False
        return output, True

    @staticmethod
    def _schema_validator(node: FlowNode, value: Any) -> tuple[Any, bool]:
        text = "" if value is None else str(value)
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return text, False
        schema = node.config.json_schema
        if schema and "required" in schema and isinstance(parsed, dict):
            for key in schema["required"]:
                if key not in parsed:
                    return parsed, False
        return parsed, True

    @staticmethod
    def _fallback(node: FlowNode, value: Any, previous_passed: bool) -> tuple[Any, bool]:
        if previous_passed:
            return value, True
        fallback = node.config.fallback_response
        return (fallback, True) if fallback is not None else (value, False)

    @staticmethod
    def _logger(node: FlowNode, value: Any) -> tuple[Any, bool]:
        text = "" if value is None else str(value)
        for marker in _UNSAFE_MARKERS:
            if marker in text.lower():
                return value, False
        return value, True
