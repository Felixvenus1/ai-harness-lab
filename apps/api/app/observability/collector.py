"""Purpose: TraceCollector — a lightweight context object populated during executor runs.

The collector is created before execution, passed into the FlowExecutor, and
finalized (scored + saved) after execution completes.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.observability.models import Span, SpanKind, SpanStatus, Trace
from app.observability.scoring import score_trajectory
from app.observability.storage import new_trace_id, save_trace


class TraceCollector:
    """Builds a Trace incrementally as the executor processes nodes."""

    def __init__(
        self,
        *,
        flow_id: str | None = None,
        flow_name: str | None = None,
        run_id: str | None = None,
        harness_version: str = "1.0",
    ) -> None:
        self.trace_id = new_trace_id()
        self._trace = Trace(
            trace_id=self.trace_id,
            run_id=run_id,
            flow_id=flow_id,
            flow_name=flow_name,
            harness_version=harness_version,
            started_at=datetime.now(timezone.utc),
        )

    # ------------------------------------------------------------------
    # Span recording
    # ------------------------------------------------------------------

    def add_span(
        self,
        *,
        kind: SpanKind,
        name: str,
        started_at: datetime,
        ended_at: datetime,
        input: Any = None,
        output: Any = None,
        status: SpanStatus = SpanStatus.SUCCESS,
        error: str | None = None,
        parent_span_id: str | None = None,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
        cost_usd: float | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Span:
        latency_ms = (ended_at - started_at).total_seconds() * 1000.0
        span = Span(
            span_id=str(uuid.uuid4()),
            trace_id=self.trace_id,
            parent_span_id=parent_span_id,
            kind=kind,
            name=name,
            started_at=started_at,
            ended_at=ended_at,
            latency_ms=round(latency_ms, 3),
            input=input,
            output=output,
            status=status,
            error=error,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
            metadata=metadata or {},
        )
        self._trace.spans.append(span)
        return span

    # ------------------------------------------------------------------
    # Finalization
    # ------------------------------------------------------------------

    def finalize(
        self,
        *,
        final_output: Any,
        passed: bool,
        total_latency_ms: float,
        guardrail_blocked: bool = False,
        guardrail_summary: list[dict[str, Any]] | None = None,
    ) -> Trace:
        now = datetime.now(timezone.utc)
        self._trace.ended_at = now
        self._trace.final_output = final_output
        self._trace.passed = passed
        self._trace.total_latency_ms = round(total_latency_ms, 3)
        self._trace.guardrail_blocked = guardrail_blocked
        self._trace.guardrail_summary = guardrail_summary or []
        self._trace.trajectory_score = score_trajectory(self._trace.spans)
        save_trace(self._trace)
        return self._trace

    @property
    def trace(self) -> Trace:
        return self._trace
