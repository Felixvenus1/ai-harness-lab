"""Purpose: Pydantic models for traces, spans, and trajectory scoring."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SpanKind(str, Enum):
    MODEL_CALL = "model_call"
    TOOL_CALL = "tool_call"
    RETRIEVAL = "retrieval"
    VALIDATION = "validation"
    GUARDRAIL = "guardrail"
    FALLBACK = "fallback"
    RETRY = "retry"
    GENERAL = "general"


class SpanStatus(str, Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    BLOCKED = "blocked"
    REDACTED = "redacted"
    RETRIED = "retried"


class Span(BaseModel):
    """A single step within a trace, capturing one unit of work."""

    span_id: str
    trace_id: str
    parent_span_id: str | None = None
    kind: SpanKind = SpanKind.GENERAL
    name: str
    started_at: datetime
    ended_at: datetime
    latency_ms: float
    input: Any = None
    output: Any = None
    status: SpanStatus = SpanStatus.SUCCESS
    error: str | None = None
    # Token / cost fields are only set for model_call spans.
    input_tokens: int | None = None
    output_tokens: int | None = None
    cost_usd: float | None = None
    # Arbitrary extra data (guardrail decisions, policy names, etc.)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TrajectoryScore(BaseModel):
    """Aggregate statistics computed over a trace's spans."""

    total_steps: int
    tool_call_count: int
    retry_count: int
    failed_span_rate: float
    blocked_span_rate: float
    median_step_latency_ms: float
    p95_step_latency_ms: float
    # Informational note when sample size is too small for reliable stats.
    sample_note: str | None = None


class Trace(BaseModel):
    """An end-to-end request trace — one per /run invocation."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    trace_id: str
    run_id: str | None = None
    flow_id: str | None = None
    flow_name: str | None = None
    harness_version: str = "1.0"
    started_at: datetime
    ended_at: datetime | None = None
    total_latency_ms: float | None = None
    spans: list[Span] = Field(default_factory=list)
    final_output: Any = None
    passed: bool | None = None
    trajectory_score: TrajectoryScore | None = None
    # Guardrail summary if policies were run.
    guardrail_blocked: bool = False
    guardrail_summary: list[dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TraceSummary(BaseModel):
    """Lightweight trace listing without span detail."""

    trace_id: str
    run_id: str | None = None
    flow_name: str | None = None
    harness_version: str
    started_at: datetime
    total_latency_ms: float | None = None
    passed: bool | None = None
    guardrail_blocked: bool = False
    span_count: int
    failed_span_count: int
