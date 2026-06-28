"""Purpose: POST /flows/validate — check a FlowGraph for structural correctness before execution."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from harness_core.node_types import NodeType
from harness_core.schemas import FlowGraph

router = APIRouter(tags=["flows"])


class ValidationIssue(BaseModel):
    level: Literal["error", "warning", "info"]
    code: str
    message: str
    node_id: str | None = None
    edge_id: str | None = None


class ValidationResult(BaseModel):
    valid: bool  # False when any error-level issue exists
    issues: list[ValidationIssue]


@router.post("/flows/validate", response_model=ValidationResult)
def validate_flow(graph: FlowGraph) -> ValidationResult:
    issues: list[ValidationIssue] = []

    if not graph.nodes:
        issues.append(
            ValidationIssue(level="error", code="EMPTY_GRAPH", message="Graph has no nodes.")
        )
        return ValidationResult(valid=False, issues=issues)

    node_ids = {n.id for n in graph.nodes}

    # Edge referential integrity
    for edge in graph.edges:
        if edge.source not in node_ids:
            issues.append(
                ValidationIssue(
                    level="error",
                    code="UNKNOWN_SOURCE",
                    message=f"Edge source '{edge.source}' does not reference a known node.",
                    edge_id=edge.id,
                )
            )
        if edge.target not in node_ids:
            issues.append(
                ValidationIssue(
                    level="error",
                    code="UNKNOWN_TARGET",
                    message=f"Edge target '{edge.target}' does not reference a known node.",
                    edge_id=edge.id,
                )
            )
        if edge.policy.routing_rule == "on_condition" and not edge.policy.condition:
            issues.append(
                ValidationIssue(
                    level="warning",
                    code="MISSING_CONDITION",
                    message=f"Edge from '{edge.source}' to '{edge.target}' uses 'on_condition' but has no condition expression.",
                    edge_id=edge.id,
                )
            )

    # Isolated nodes (no incoming AND no outgoing edges when graph has >1 node)
    if len(graph.nodes) > 1:
        connected: set[str] = set()
        for edge in graph.edges:
            connected.add(edge.source)
            connected.add(edge.target)
        for node in graph.nodes:
            if node.id not in connected:
                issues.append(
                    ValidationIssue(
                        level="warning",
                        code="ISOLATED_NODE",
                        message=f"Node '{node.id}' ({node.type.value}) has no connections.",
                        node_id=node.id,
                    )
                )

    # Router-specific: warn if no routes defined
    for node in graph.nodes:
        if node.type == NodeType.ROUTER:
            routes = node.config.routes or []
            if not routes:
                issues.append(
                    ValidationIssue(
                        level="warning",
                        code="ROUTER_NO_ROUTES",
                        message=f"Router '{node.id}' has no routes; all traffic will use the 'default' handle.",
                        node_id=node.id,
                    )
                )
        elif node.type == NodeType.LOOP:
            if not node.config.loop_target:
                issues.append(
                    ValidationIssue(
                        level="warning",
                        code="LOOP_NO_TARGET",
                        message=f"Loop node '{node.id}' has no loop_target set.",
                        node_id=node.id,
                    )
                )

    # Cycle detection (DFS) — warn; may be intentional with loop nodes
    if _has_cycle(graph):
        issues.append(
            ValidationIssue(
                level="warning",
                code="CYCLE_DETECTED",
                message="Graph contains a cycle. This is valid only if loop nodes are used intentionally.",
            )
        )

    fatal = any(i.level == "error" for i in issues)
    return ValidationResult(valid=not fatal, issues=issues)


def _has_cycle(graph: FlowGraph) -> bool:
    adj: dict[str, list[str]] = {n.id: [] for n in graph.nodes}
    for edge in graph.edges:
        if edge.source in adj:
            adj[edge.source].append(edge.target)

    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[str, int] = {n.id: WHITE for n in graph.nodes}

    def dfs(nid: str) -> bool:
        color[nid] = GRAY
        for neighbor in adj.get(nid, []):
            if color.get(neighbor) == GRAY:
                return True
            if color.get(neighbor) == WHITE and dfs(neighbor):
                return True
        color[nid] = BLACK
        return False

    return any(dfs(n.id) for n in graph.nodes if color[n.id] == WHITE)
