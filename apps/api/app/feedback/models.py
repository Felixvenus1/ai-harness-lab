"""Purpose: Pydantic models for user feedback and regression datasets."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class FeedbackSignal(str, Enum):
    THUMBS_UP = "thumbs_up"
    THUMBS_DOWN = "thumbs_down"


class FeedbackCategory(str, Enum):
    INCORRECT = "incorrect"
    UNSAFE = "unsafe"
    INCOMPLETE = "incomplete"
    SLOW = "slow"
    BAD_FORMAT = "bad_format"
    HALLUCINATION = "hallucination"
    OTHER = "other"


class FeedbackCreate(BaseModel):
    """Request body for submitting new feedback."""

    trace_id: str
    run_id: str | None = None
    signal: FeedbackSignal
    categories: list[FeedbackCategory] = Field(default_factory=list)
    note: str | None = None
    harness_version: str | None = None
    model_version: str | None = None


class Feedback(FeedbackCreate):
    """Persisted feedback record."""

    feedback_id: str
    created_at: datetime


class FeedbackStats(BaseModel):
    """Aggregate statistics over a collection of feedback items."""

    total: int
    thumbs_up: int
    thumbs_down: int
    thumbs_up_rate: float
    thumbs_down_rate: float
    # category_name -> count
    category_counts: dict[str, int]
    # harness_version -> {thumbs_up, thumbs_down, total}
    by_harness_version: dict[str, dict[str, int]]
    sample_note: str | None = None


class RegressionDatasetCreate(BaseModel):
    """Request to convert a list of feedback IDs into a regression dataset."""

    feedback_ids: list[str]
    name: str


class RegressionDatasetRow(BaseModel):
    """One row in a regression dataset derived from feedback."""

    feedback_id: str
    trace_id: str
    run_id: str | None = None
    input: Any = None
    reference_output: Any = None
    model_output: Any = None
    signal: FeedbackSignal
    categories: list[FeedbackCategory]
    note: str | None = None
    harness_version: str | None = None
    model_version: str | None = None
    # Original trace trajectory score (serialized dict)
    trajectory_score: dict[str, Any] | None = None
    # Judge scores captured at evaluation time
    judge_scores: dict[str, float] = Field(default_factory=dict)


class RegressionDataset(BaseModel):
    """A persisted regression dataset derived from feedback rows."""

    dataset_id: str
    name: str
    created_at: datetime
    feedback_ids: list[str]
    rows: list[RegressionDatasetRow]
    row_count: int
