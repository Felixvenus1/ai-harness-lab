"""Purpose: Pydantic schemas for all evaluation I/O (evaluation-module level)."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class DatasetRow(BaseModel):
    """A single row from an uploaded evaluation dataset."""

    row_id: str
    input: str
    reference: str
    label: Optional[str] = None
    group: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class DatasetUploadResponse(BaseModel):
    """Response from a successful dataset upload."""

    id: str
    name: str
    row_count: int
    input_field: str
    reference_field: str
    label_field: Optional[str] = None
    group_field: Optional[str] = None
    preview: list[dict[str, Any]] = Field(default_factory=list)
    field_types: dict[str, str] = Field(default_factory=dict)
    null_counts: dict[str, int] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


class RunStartRequest(BaseModel):
    """Request to start a benchmark run."""

    harness_id: str
    dataset_id: str
    metrics: list[str] = Field(
        default=["accuracy", "cost", "latency"],
        description="Metrics to compute: accuracy, cost, latency, robustness, judge",
    )
    compare_harness_id: Optional[str] = None
    concurrency: int = Field(default=1, ge=1, le=5)
    judge_config: Optional[dict[str, Any]] = None


class RunProgressUpdate(BaseModel):
    """Live progress update during a benchmark run."""

    run_id: str
    rows_completed: int
    row_count: int
    accuracy_rate: Optional[float] = None
    mean_latency_ms: Optional[float] = None
    cumulative_cost_usd: float = 0.0
    status: str = "running"


class PerturbRequest(BaseModel):
    """Request to generate perturbations for a single input."""

    input: str
    strategies: list[str] = Field(
        default=["casing", "whitespace", "typo_inject"],
    )
    n_variants: int = Field(default=5, ge=1, le=20)
    typo_rate: float = Field(default=0.02, ge=0.0, le=0.2)


class CompareRequest(BaseModel):
    """Request to run Bayesian comparison between two run IDs."""

    run_a_id: str
    run_b_id: str
    metrics: list[str] = Field(default=["accuracy", "bertscore", "cost_usd", "latency_ms"])
    rope_delta: float = Field(default=0.02, ge=0.0, le=0.5)


class JudgeScoreRequest(BaseModel):
    """Request to score a single output with a judge model."""

    input: str
    output: str
    reference: Optional[str] = None
    rubric: str
    scale: str = "1-5"
    provider: str = "mock"
    model: str = "mock"


class JudgeScoreResponse(BaseModel):
    """Response from a judge scoring request."""

    score: float
    explanation: str
    raw_response: str
