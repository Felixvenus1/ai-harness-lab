"""Purpose: File-based persistence for traces — stored in data/traces/."""
from __future__ import annotations

import json
import uuid
from pathlib import Path

from app.observability.models import Trace, TraceSummary

_API_ROOT = Path(__file__).parent.parent.parent  # apps/api/
_TRACES_DIR = _API_ROOT / "data" / "traces"


def _ensure_dirs() -> None:
    _TRACES_DIR.mkdir(parents=True, exist_ok=True)


def new_trace_id() -> str:
    return str(uuid.uuid4())


def save_trace(trace: Trace) -> None:
    """Write a trace to disk as JSON."""
    _ensure_dirs()
    path = _TRACES_DIR / f"{trace.trace_id}.json"
    path.write_text(trace.model_dump_json(indent=2), encoding="utf-8")


def load_trace(trace_id: str) -> Trace:
    """Load a trace by ID. Raises FileNotFoundError if missing."""
    path = _TRACES_DIR / f"{trace_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"trace {trace_id!r} not found")
    return Trace.model_validate_json(path.read_text(encoding="utf-8"))


def list_traces(limit: int = 100) -> list[TraceSummary]:
    """Return lightweight summaries for the most recent traces (newest first)."""
    _ensure_dirs()
    paths = sorted(_TRACES_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    summaries: list[TraceSummary] = []
    for p in paths[:limit]:
        try:
            trace = Trace.model_validate_json(p.read_text(encoding="utf-8"))
            failed = sum(1 for s in trace.spans if s.status.value in ("failure", "blocked"))
            summaries.append(
                TraceSummary(
                    trace_id=trace.trace_id,
                    run_id=trace.run_id,
                    flow_name=trace.flow_name,
                    harness_version=trace.harness_version,
                    started_at=trace.started_at,
                    total_latency_ms=trace.total_latency_ms,
                    passed=trace.passed,
                    guardrail_blocked=trace.guardrail_blocked,
                    span_count=len(trace.spans),
                    failed_span_count=failed,
                )
            )
        except Exception:  # noqa: BLE001
            pass
    return summaries
