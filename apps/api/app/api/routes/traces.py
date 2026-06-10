"""Purpose: Trace endpoints — list, retrieve, and inspect observability traces."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.observability.models import Trace, TraceSummary
from app.observability.storage import list_traces, load_trace

router = APIRouter(prefix="/traces", tags=["observability"])


@router.get("", response_model=list[TraceSummary])
def get_traces(limit: int = 100) -> list[TraceSummary]:
    """Return lightweight summaries for the most recent traces."""
    return list_traces(limit=min(limit, 500))


@router.get("/{trace_id}", response_model=Trace)
def get_trace(trace_id: str) -> Trace:
    """Return the full trace including all spans and trajectory score."""
    try:
        return load_trace(trace_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Trace {trace_id!r} not found.")
