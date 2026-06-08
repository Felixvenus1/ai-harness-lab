"""Purpose: Define Pydantic schemas for flow graphs, node config, and execution results."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from harness_core.node_types import NodeType


class NodeConfig(BaseModel):
    """Per-node configuration. Fields are optional and interpreted by node type.

    Unknown keys are allowed so new node behaviours can be added without a schema bump.
    """

    model_config = ConfigDict(extra="allow")

    # input_validator
    required: bool = True
    min_length: int | None = None
    max_length: int | None = None

    # normaliser
    strip: bool = True
    lowercase: bool = False
    template: str | None = None

    # model
    provider: str = "mock"
    system_prompt: str | None = None
    # Mock behaviour selector: valid_json | malformed_json | timeout | unsafe | echo
    response_mode: str = "valid_json"

    # schema_validator
    json_schema: dict[str, Any] | None = None

    # fallback
    fallback_response: str | None = None

    # logger
    label: str | None = None


class FlowNode(BaseModel):
    """A single node in the flow graph."""

    id: str
    type: NodeType
    config: NodeConfig = Field(default_factory=NodeConfig)


class FlowEdge(BaseModel):
    """A directed connection from one node to another."""

    source: str
    target: str


class FlowGraph(BaseModel):
    """A complete harness flow: nodes, edges, and an optional starting input."""

    id: str | None = None
    name: str | None = None
    initial_input: str = ""
    nodes: list[FlowNode]
    edges: list[FlowEdge] = Field(default_factory=list)


class ExecutionResult(BaseModel):
    """The outcome of executing a single node."""

    node_id: str
    node_type: NodeType
    input: Any = None
    output: Any = None
    passed: bool = True
    error: str | None = None
    duration_ms: float = 0.0


class ExecutionTrace(BaseModel):
    """The aggregate result of executing a flow graph."""

    passed: bool
    final_output: Any = None
    results: list[ExecutionResult] = Field(default_factory=list)
    total_duration_ms: float = 0.0
