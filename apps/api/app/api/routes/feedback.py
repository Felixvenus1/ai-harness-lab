"""Purpose: Feedback endpoints — submit feedback and create regression datasets."""
from __future__ import annotations

import csv
import io
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.feedback.converter import build_regression_dataset
from app.feedback.models import (
    Feedback,
    FeedbackCreate,
    FeedbackStats,
    RegressionDataset,
    RegressionDatasetCreate,
)
from app.feedback.storage import (
    compute_feedback_stats,
    list_feedback,
    list_regression_datasets,
    load_feedback,
    load_regression_dataset,
    save_feedback,
    save_regression_dataset,
)

router = APIRouter(prefix="/feedback", tags=["feedback"])


# ---------------------------------------------------------------------------
# Feedback CRUD
# ---------------------------------------------------------------------------


@router.post("", response_model=Feedback, status_code=201)
def submit_feedback(body: FeedbackCreate) -> Feedback:
    """Record user feedback against a trace."""
    fb = Feedback(
        **body.model_dump(),
        feedback_id=str(uuid.uuid4()),
        created_at=datetime.now(timezone.utc),
    )
    save_feedback(fb)
    return fb


@router.get("", response_model=list[Feedback])
def get_feedback(
    signal: str | None = None,
    harness_version: str | None = None,
    limit: int = 200,
) -> list[Feedback]:
    """List feedback, newest first, with optional filters."""
    return list_feedback(signal=signal, harness_version=harness_version, limit=limit)


@router.get("/stats", response_model=FeedbackStats)
def get_feedback_stats(harness_version: str | None = None) -> FeedbackStats:
    """Return aggregate thumbs up/down rates and category breakdown."""
    items = list_feedback(harness_version=harness_version, limit=10_000)
    return compute_feedback_stats(items)


@router.get("/{feedback_id}", response_model=Feedback)
def get_single_feedback(feedback_id: str) -> Feedback:
    try:
        return load_feedback(feedback_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Feedback {feedback_id!r} not found.")


# ---------------------------------------------------------------------------
# Regression dataset creation
# ---------------------------------------------------------------------------


@router.post("/regression-datasets", response_model=RegressionDataset, status_code=201)
def create_regression_dataset(body: RegressionDatasetCreate) -> RegressionDataset:
    """Convert selected negative-feedback traces into a regression dataset."""
    feedback_items = []
    missing: list[str] = []
    for fid in body.feedback_ids:
        try:
            feedback_items.append(load_feedback(fid))
        except FileNotFoundError:
            missing.append(fid)

    if missing:
        raise HTTPException(
            status_code=404,
            detail=f"Feedback item(s) not found: {missing}",
        )

    dataset = build_regression_dataset(feedback_items, name=body.name)
    save_regression_dataset(dataset)
    return dataset


@router.get("/regression-datasets", response_model=list[dict])
def list_regression_dataset_index() -> list[dict]:
    return list_regression_datasets()


@router.get("/regression-datasets/{dataset_id}", response_model=RegressionDataset)
def get_regression_dataset(dataset_id: str) -> RegressionDataset:
    try:
        return load_regression_dataset(dataset_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id!r} not found.")


@router.get("/regression-datasets/{dataset_id}/export")
def export_regression_dataset(dataset_id: str, format: str = "json") -> StreamingResponse:
    """Export a regression dataset as JSON or CSV."""
    try:
        dataset = load_regression_dataset(dataset_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id!r} not found.")

    if format == "csv":
        buf = io.StringIO()
        if dataset.rows:
            fieldnames = list(dataset.rows[0].model_dump().keys())
            writer = csv.DictWriter(buf, fieldnames=fieldnames)
            writer.writeheader()
            for row in dataset.rows:
                writer.writerow(row.model_dump())
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{dataset_id}.csv"'},
        )

    # Default: JSON
    content = dataset.model_dump_json(indent=2)
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{dataset_id}.json"'},
    )
