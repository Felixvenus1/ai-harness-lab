"""Tests for the observability scoring logic and feedback conversion."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

import pytest

from app.observability.models import Span, SpanKind, SpanStatus
from app.observability.scoring import score_trajectory
from app.feedback.models import Feedback, FeedbackCategory, FeedbackSignal
from app.feedback.storage import compute_feedback_stats


def _span(
    kind: SpanKind = SpanKind.GENERAL,
    status: SpanStatus = SpanStatus.SUCCESS,
    latency_ms: float = 10.0,
) -> Span:
    tid = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    return Span(
        span_id=str(uuid.uuid4()),
        trace_id=tid,
        kind=kind,
        name="test",
        started_at=now,
        ended_at=now + timedelta(milliseconds=latency_ms),
        latency_ms=latency_ms,
        status=status,
    )


def _feedback(signal: FeedbackSignal, categories=None, harness_version="1.0") -> Feedback:
    return Feedback(
        feedback_id=str(uuid.uuid4()),
        trace_id=str(uuid.uuid4()),
        signal=signal,
        categories=categories or [],
        harness_version=harness_version,
        created_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Trajectory scoring
# ---------------------------------------------------------------------------


class TestScoreTrajectory:
    def test_empty_spans(self):
        score = score_trajectory([])
        assert score.total_steps == 0
        assert score.failed_span_rate == 0.0
        assert score.sample_note is not None

    def test_all_success(self):
        spans = [_span(status=SpanStatus.SUCCESS, latency_ms=20.0) for _ in range(4)]
        score = score_trajectory(spans)
        assert score.total_steps == 4
        assert score.failed_span_rate == 0.0
        assert score.blocked_span_rate == 0.0

    def test_failed_rate(self):
        spans = [_span(status=SpanStatus.SUCCESS)] * 3 + [_span(status=SpanStatus.FAILURE)] * 1
        score = score_trajectory(spans)
        assert score.failed_span_rate == pytest.approx(0.25)

    def test_blocked_rate(self):
        spans = [_span(status=SpanStatus.BLOCKED)] * 2 + [_span(status=SpanStatus.SUCCESS)] * 2
        score = score_trajectory(spans)
        assert score.blocked_span_rate == pytest.approx(0.5)

    def test_tool_call_count(self):
        spans = [_span(kind=SpanKind.TOOL_CALL)] * 3 + [_span(kind=SpanKind.MODEL_CALL)] * 2
        score = score_trajectory(spans)
        assert score.tool_call_count == 3

    def test_retry_count(self):
        spans = [_span(kind=SpanKind.RETRY)] * 2 + [_span(status=SpanStatus.RETRIED)] * 1
        score = score_trajectory(spans)
        assert score.retry_count == 3

    def test_median_latency(self):
        spans = [_span(latency_ms=l) for l in [10.0, 20.0, 30.0]]
        score = score_trajectory(spans)
        assert score.median_step_latency_ms == 20.0

    def test_p95_small_sample_falls_back_to_max(self):
        spans = [_span(latency_ms=l) for l in [5.0, 10.0, 50.0]]
        score = score_trajectory(spans)
        # With < 20 spans, p95 == max.
        assert score.p95_step_latency_ms == 50.0


# ---------------------------------------------------------------------------
# Feedback statistics
# ---------------------------------------------------------------------------


class TestFeedbackStats:
    def test_empty(self):
        stats = compute_feedback_stats([])
        assert stats.total == 0
        assert stats.thumbs_up_rate == 0.0
        assert stats.sample_note is not None

    def test_all_up(self):
        items = [_feedback(FeedbackSignal.THUMBS_UP) for _ in range(5)]
        stats = compute_feedback_stats(items)
        assert stats.thumbs_up == 5
        assert stats.thumbs_down == 0
        assert stats.thumbs_up_rate == 1.0

    def test_mixed(self):
        items = [_feedback(FeedbackSignal.THUMBS_UP)] * 3 + [
            _feedback(FeedbackSignal.THUMBS_DOWN)
        ] * 1
        stats = compute_feedback_stats(items)
        assert stats.thumbs_up_rate == pytest.approx(0.75)
        assert stats.thumbs_down_rate == pytest.approx(0.25)

    def test_category_counts(self):
        items = [
            _feedback(FeedbackSignal.THUMBS_DOWN, categories=[FeedbackCategory.INCOMPLETE]),
            _feedback(FeedbackSignal.THUMBS_DOWN, categories=[FeedbackCategory.INCOMPLETE, FeedbackCategory.HALLUCINATION]),
        ]
        stats = compute_feedback_stats(items)
        assert stats.category_counts["incomplete"] == 2
        assert stats.category_counts["hallucination"] == 1

    def test_by_harness_version(self):
        items = [
            _feedback(FeedbackSignal.THUMBS_UP, harness_version="1.0"),
            _feedback(FeedbackSignal.THUMBS_DOWN, harness_version="1.0"),
            _feedback(FeedbackSignal.THUMBS_UP, harness_version="2.0"),
        ]
        stats = compute_feedback_stats(items)
        assert stats.by_harness_version["1.0"]["total"] == 2
        assert stats.by_harness_version["2.0"]["thumbs_up"] == 1
