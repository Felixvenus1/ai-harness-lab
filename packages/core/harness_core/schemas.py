"""Purpose: Define Pydantic schemas for flow graphs, node config, and execution results."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

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
