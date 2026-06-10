"""Purpose: Compute trajectory scores from a list of spans."""
from __future__ import annotations

import statistics
from typing import Sequence

from app.observability.models import Span, SpanKind, SpanStatus, TrajectoryScore

# At or below this span count we note unreliable percentile stats.
_SMALL_SAMPLE = 5


def score_trajectory(spans: Sequence[Span]) -> TrajectoryScore:
    """Compute aggregate statistics over a trace's spans."""
    if not spans:
        return TrajectoryScore(
            total_steps=0,
            tool_call_count=0,
            retry_count=0,
            failed_span_rate=0.0,
            blocked_span_rate=0.0,
            median_step_latency_ms=0.0,
            p95_step_latency_ms=0.0,
            sample_note="No spans recorded.",
        )

    total = len(spans)
    tool_calls = sum(1 for s in spans if s.kind == SpanKind.TOOL_CALL)
    retries = sum(1 for s in spans if s.kind == SpanKind.RETRY or s.status == SpanStatus.RETRIED)
    failed = sum(1 for s in spans if s.status == SpanStatus.FAILURE)
    blocked = sum(1 for s in spans if s.status == SpanStatus.BLOCKED)

    latencies = sorted(s.latency_ms for s in spans)
    median_lat = statistics.median(latencies)

    # True p95 requires >= 20 samples; fall back to max for small sets.
    if total >= 20:
        p95_idx = int(0.95 * total) - 1
        p95_lat = latencies[p95_idx]
        sample_note = None
    else:
        p95_lat = latencies[-1]
        sample_note = (
            f"p95 latency estimated from max ({total} spans; reliable p95 needs ≥20)."
            if total < _SMALL_SAMPLE
            else None
        )

    return TrajectoryScore(
        total_steps=total,
        tool_call_count=tool_calls,
        retry_count=retries,
        failed_span_rate=round(failed / total, 4),
        blocked_span_rate=round(blocked / total, 4),
        median_step_latency_ms=round(median_lat, 3),
        p95_step_latency_ms=round(p95_lat, 3),
        sample_note=sample_note,
    )
