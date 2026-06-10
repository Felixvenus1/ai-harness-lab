"""Purpose: Convert feedback + trace records into regression dataset rows."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.feedback.models import (
    Feedback,
    RegressionDataset,
    RegressionDatasetRow,
)
from app.observability.storage import load_trace


def build_regression_dataset(
    feedback_items: list[Feedback],
    name: str,
) -> RegressionDataset:
    """Convert a list of feedback records into a RegressionDataset.

    For each feedback item, we attempt to load the associated trace so that
    we can capture the original input, model output, and trajectory score.
    Missing traces are handled gracefully (fields left null).
    """
    rows: list[RegressionDatasetRow] = []

    for fb in feedback_items:
        trace_input = None
        trace_output = None
        trajectory_score = None
        judge_scores: dict = {}

        try:
            trace = load_trace(fb.trace_id)
            # Use the flow's initial input as the row input.
            if trace.spans:
                first_span = trace.spans[0]
                trace_input = first_span.input
            trace_output = trace.final_output
            if trace.trajectory_score:
                trajectory_score = trace.trajectory_score.model_dump()
        except FileNotFoundError:
            pass  # Trace may have been pruned; leave fields null.

        rows.append(
            RegressionDatasetRow(
                feedback_id=fb.feedback_id,
                trace_id=fb.trace_id,
                run_id=fb.run_id,
                input=trace_input,
                reference_output=None,  # Caller can fill this in via update
                model_output=trace_output,
                signal=fb.signal,
                categories=fb.categories,
                note=fb.note,
                harness_version=fb.harness_version,
                model_version=fb.model_version,
                trajectory_score=trajectory_score,
                judge_scores=judge_scores,
            )
        )

    return RegressionDataset(
        dataset_id=str(uuid.uuid4()),
        name=name,
        created_at=datetime.now(timezone.utc),
        feedback_ids=[fb.feedback_id for fb in feedback_items],
        rows=rows,
        row_count=len(rows),
    )
