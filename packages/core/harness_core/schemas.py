"""Purpose: Define Pydantic schemas for flow graphs, node config, and execution results."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional
from uuid import uuid4

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
    model: str | None = None          # provider-specific model ID, e.g. "claude-haiku-4-5-20251001"
    system_prompt: str | None = None
    # Mock behaviour selector: valid_json | malformed_json | timeout | unsafe | echo
    response_mode: str = "valid_json"

    # schema_validator
    json_schema: dict[str, Any] | None = None

    # fallback
    fallback_response: str | None = None

    # logger
    label: str | None = None

    # router — list of {"source_handle": str, "expression": str, "label": str}
    routes: list[dict[str, str]] | None = None

    # merge
    merge_strategy: Literal["first_wins", "all_required"] = "first_wins"

    # loop
    max_iterations: int = 3
    exit_condition: str | None = None
    loop_target: str | None = None  # node_id to feed back into


class FlowNode(BaseModel):
    """A single node in the flow graph."""

    id: str
    type: NodeType
    config: NodeConfig = Field(default_factory=NodeConfig)


# ---------------------------------------------------------------------------
# Connector (was FlowEdge) — now a first-class runtime object
# ---------------------------------------------------------------------------


class ConnectorPolicy(BaseModel):
    """Runtime policy attached to a connector between two nodes."""

    routing_rule: Literal["always", "on_success", "on_failure", "on_condition"] = "always"
    # Python expression evaluated against {"passed": bool, "output": Any}
    condition: str | None = None
    retry_limit: int = 0
    retry_delay_ms: int = 500
    timeout_ms: int | None = None
    cost_limit_usd: float | None = None
    log_on_traverse: bool = False


class ConnectorConfig(BaseModel):
    """A directed edge between two nodes, carrying policy and routing metadata."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    source: str
    target: str
    source_handle: str | None = None   # named output port (e.g. "on_success" on router)
    target_handle: str | None = None   # named input port (e.g. "merge-a")
    label: str | None = None
    policy: ConnectorPolicy = Field(default_factory=ConnectorPolicy)
    metadata: dict[str, Any] = Field(default_factory=dict)


# FlowEdge kept as an alias so existing call-sites that use it still work.
FlowEdge = ConnectorConfig


class FlowGraph(BaseModel):
    """A complete harness flow: nodes, edges, and an optional starting input."""

    id: str | None = None
    name: str | None = None
    initial_input: str = ""
    nodes: list[FlowNode]
    edges: list[ConnectorConfig] = Field(default_factory=list)


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


# ---------------------------------------------------------------------------
# Evaluation module schemas (FR-12)
# ---------------------------------------------------------------------------


class DatasetSchema(BaseModel):
    """Metadata about an uploaded evaluation dataset."""

    id: str
    name: str
    input_field: str
    reference_field: str
    label_field: Optional[str] = None
    group_field: Optional[str] = None
    row_count: int


class EvaluationRecord(BaseModel):
    """Per-row result produced by the benchmark runner."""

    row_id: str
    input: str
    reference: str
    output: str
    group: Optional[str] = None
    latency_ms: float
    input_tokens: int
    output_tokens: int
    cost_usd: float
    scores: dict[str, float] = Field(default_factory=dict)
    judge_score: Optional[float] = None
    judge_explanation: Optional[str] = None
    error: Optional[str] = None


class BenchmarkRun(BaseModel):
    """A complete benchmark run over a dataset."""

    id: str
    harness_id: str
    dataset_id: str
    timestamp: datetime
    row_count: int
    metrics_config: list[str] = Field(default_factory=list)
    records: list[EvaluationRecord] = Field(default_factory=list)
    summary: dict[str, Any] = Field(default_factory=dict)


class BayesianResult(BaseModel):
    """Result of Bayesian comparison between two benchmark runs."""

    metric: str
    run_a_id: str
    run_b_id: str
    posterior_a: dict[str, Any] = Field(default_factory=dict)
    posterior_b: dict[str, Any] = Field(default_factory=dict)
    prob_a_superior: float
    expected_uplift: float
    uplift_hpdr_90: tuple[float, float]
    rope_probability: float


class JudgeConfig(BaseModel):
    """Configuration for an LLM judge."""

    judge_provider: str
    judge_model: str
    mode: Literal["pointwise", "pairwise", "jury"]
    rubric: str
    scale: Literal["binary", "1-5", "0-10"]
    jury_models: Optional[list[str]] = None
