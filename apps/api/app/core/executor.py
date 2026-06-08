"""Purpose: Execute a FlowGraph node-by-node in topological order and build a trace."""
from __future__ import annotations

import json
import time
from typing import Any

from harness_core.node_types import NodeType
from harness_core.schemas import (
    ExecutionResult,
    ExecutionTrace,
    FlowGraph,
    FlowNode,
)

from app.providers.mock_provider import ProviderTimeoutError
from app.providers.registry import get_provider

# Crude signal words used by the safety check on model output.
_UNSAFE_MARKERS = ("dangerous weapon", "build a bomb", "make a weapon")


class FlowExecutionError(Exception):
    """Raised when a flow cannot be executed (e.g. a cycle or missing node)."""


def _topological_order(graph: FlowGraph) -> list[FlowNode]:
    """Return nodes ordered so every node comes after its predecessors (Kahn's algorithm)."""
    nodes_by_id = {node.id: node for node in graph.nodes}
    indegree = {node.id: 0 for node in graph.nodes}
    adjacency: dict[str, list[str]] = {node.id: [] for node in graph.nodes}

    for edge in graph.edges:
        if edge.source not in nodes_by_id or edge.target not in nodes_by_id:
            raise FlowExecutionError(
                f"edge references unknown node: {edge.source} -> {edge.target}"
            )
        adjacency[edge.source].append(edge.target)
        indegree[edge.target] += 1

    # Preserve declared order among nodes that are ready at the same time.
    ready = [node for node in graph.nodes if indegree[node.id] == 0]
    ordered: list[FlowNode] = []

    while ready:
        node = ready.pop(0)
        ordered.append(node)
        for target_id in adjacency[node.id]:
            indegree[target_id] -= 1
            if indegree[target_id] == 0:
                ready.append(nodes_by_id[target_id])

    if len(ordered) != len(graph.nodes):
        raise FlowExecutionError("flow graph contains a cycle")

    return ordered


class FlowExecutor:
    """Executes a FlowGraph and produces an ExecutionTrace."""

    def __init__(self, graph: FlowGraph) -> None:
        self.graph = graph

    def run(self) -> ExecutionTrace:
        ordered = _topological_order(self.graph)

        current: Any = self.graph.initial_input
        previous_passed = True
        results: list[ExecutionResult] = []
        total = 0.0

        for node in ordered:
            started = time.perf_counter()
            node_input = current
            try:
                output, passed = self._run_node(node, node_input, previous_passed)
                error = None
            except Exception as exc:  # noqa: BLE001 - surfaced into the trace
                output, passed, error = node_input, False, str(exc)

            duration = (time.perf_counter() - started) * 1000.0
            total += duration

            results.append(
                ExecutionResult(
                    node_id=node.id,
                    node_type=node.type,
                    input=node_input,
                    output=output,
                    passed=passed,
                    error=error,
                    duration_ms=round(duration, 3),
                )
            )

            current = output
            previous_passed = passed

        return ExecutionTrace(
            passed=all(r.passed for r in results),
            final_output=current,
            results=results,
            total_duration_ms=round(total, 3),
        )

    def _run_node(
        self, node: FlowNode, value: Any, previous_passed: bool
    ) -> tuple[Any, bool]:
        """Dispatch to the handler for the node type, returning (output, passed)."""
        handlers = {
            NodeType.INPUT_VALIDATOR: self._input_validator,
            NodeType.NORMALISER: self._normaliser,
            NodeType.MODEL: self._model,
            NodeType.SCHEMA_VALIDATOR: self._schema_validator,
            NodeType.FALLBACK: self._fallback,
            NodeType.LOGGER: self._logger,
        }
        handler = handlers[node.type]
        if node.type == NodeType.FALLBACK:
            return self._fallback(node, value, previous_passed)
        return handler(node, value)

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
    def _model(node: FlowNode, value: Any) -> tuple[Any, bool]:
        cfg = node.config
        provider = get_provider(cfg.provider)
        # The mock provider exposes a behaviour switch; real providers ignore it.
        if hasattr(provider, "mode"):
            provider.mode = cfg.response_mode

        messages: list[dict[str, str]] = []
        if cfg.system_prompt:
            messages.append({"role": "system", "content": cfg.system_prompt})
        messages.append({"role": "user", "content": "" if value is None else str(value)})

        try:
            output = provider.complete(messages)
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
        if fallback is None:
            return value, False
        return fallback, True

    @staticmethod
    def _logger(node: FlowNode, value: Any) -> tuple[Any, bool]:
        text = "" if value is None else str(value)
        for marker in _UNSAFE_MARKERS:
            if marker in text.lower():
                # Surface unsafe output as a failed checkpoint but pass the value through.
                return value, False
        return value, True
