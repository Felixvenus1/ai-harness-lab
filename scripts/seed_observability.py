"""Purpose: Seed example policies, a trace, and feedback items for local development.

Run with:  python scripts/seed_observability.py
(from the repo root or the apps/api directory)
"""
from __future__ import annotations

import sys
import os

# Make sure the packages are importable.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "apps", "api"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "packages", "core"))

import uuid
from datetime import datetime, timezone, timedelta

from app.guardrails.models import PolicyAction, PolicyConfig, PolicyType
from app.guardrails.storage import save_policy

from app.observability.models import Span, SpanKind, SpanStatus, Trace, TrajectoryScore
from app.observability.storage import save_trace

from app.feedback.models import Feedback, FeedbackCategory, FeedbackSignal
from app.feedback.storage import save_feedback


def _dt(offset_s: float = 0.0) -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=offset_s)


def seed_policies() -> None:
    policies = [
        PolicyConfig(
            policy_id="policy-pii-warn",
            name="PII Warn",
            type=PolicyType.PII,
            action=PolicyAction.WARN,
            enabled=True,
            params={},
        ),
        PolicyConfig(
            policy_id="policy-injection-block",
            name="Prompt Injection Block",
            type=PolicyType.PROMPT_INJECTION,
            action=PolicyAction.BLOCK,
            enabled=True,
            params={},
        ),
        PolicyConfig(
            policy_id="policy-hate-block",
            name="Hate Block",
            type=PolicyType.HATE,
            action=PolicyAction.BLOCK,
            enabled=True,
            params={},
        ),
        PolicyConfig(
            policy_id="policy-danger-block",
            name="Dangerous Intent Block",
            type=PolicyType.DANGEROUS_INTENT,
            action=PolicyAction.BLOCK,
            enabled=True,
            params={},
        ),
        PolicyConfig(
            policy_id="policy-pii-redact",
            name="PII Redact (output)",
            type=PolicyType.PII,
            action=PolicyAction.REDACT,
            enabled=False,  # Off by default — enable when needed
            params={},
        ),
    ]
    for p in policies:
        save_policy(p)
    print(f"  Seeded {len(policies)} policies.")


def seed_trace() -> str:
    now = _dt()
    trace_id = str(uuid.uuid4())
    spans = [
        Span(
            span_id=str(uuid.uuid4()),
            trace_id=trace_id,
            kind=SpanKind.GUARDRAIL,
            name="input_guardrail",
            started_at=now,
            ended_at=now + timedelta(milliseconds=2),
            latency_ms=2.1,
            input="Hello, can you help me reset my password?",
            output="allow",
            status=SpanStatus.SUCCESS,
        ),
        Span(
            span_id=str(uuid.uuid4()),
            trace_id=trace_id,
            kind=SpanKind.VALIDATION,
            name="input_validator:v1",
            started_at=now + timedelta(milliseconds=3),
            ended_at=now + timedelta(milliseconds=4),
            latency_ms=1.0,
            input="Hello, can you help me reset my password?",
            output="Hello, can you help me reset my password?",
            status=SpanStatus.SUCCESS,
        ),
        Span(
            span_id=str(uuid.uuid4()),
            trace_id=trace_id,
            kind=SpanKind.MODEL_CALL,
            name="model:m1",
            started_at=now + timedelta(milliseconds=5),
            ended_at=now + timedelta(milliseconds=145),
            latency_ms=140.0,
            input="Hello, can you help me reset my password?",
            output='{"answer": "Sure! Go to Settings > Security > Reset Password.", "confidence": 0.95}',
            status=SpanStatus.SUCCESS,
            input_tokens=12,
            output_tokens=18,
            cost_usd=0.000014,
        ),
        Span(
            span_id=str(uuid.uuid4()),
            trace_id=trace_id,
            kind=SpanKind.VALIDATION,
            name="schema_validator:s1",
            started_at=now + timedelta(milliseconds=146),
            ended_at=now + timedelta(milliseconds=147),
            latency_ms=1.0,
            input='{"answer": "Sure! Go to Settings > Security > Reset Password.", "confidence": 0.95}',
            output={"answer": "Sure! Go to Settings > Security > Reset Password.", "confidence": 0.95},
            status=SpanStatus.SUCCESS,
        ),
        Span(
            span_id=str(uuid.uuid4()),
            trace_id=trace_id,
            kind=SpanKind.GUARDRAIL,
            name="output_guardrail",
            started_at=now + timedelta(milliseconds=148),
            ended_at=now + timedelta(milliseconds=150),
            latency_ms=2.0,
            input={"answer": "Sure! Go to Settings > Security > Reset Password.", "confidence": 0.95},
            output="allow",
            status=SpanStatus.SUCCESS,
            metadata={"decisions": []},
        ),
    ]

    trace = Trace(
        trace_id=trace_id,
        run_id=str(uuid.uuid4()),
        flow_name="Safe Customer Support",
        harness_version="1.0",
        started_at=now,
        ended_at=now + timedelta(milliseconds=152),
        total_latency_ms=152.0,
        spans=spans,
        final_output={"answer": "Sure! Go to Settings > Security > Reset Password.", "confidence": 0.95},
        passed=True,
        trajectory_score=TrajectoryScore(
            total_steps=5,
            tool_call_count=0,
            retry_count=0,
            failed_span_rate=0.0,
            blocked_span_rate=0.0,
            median_step_latency_ms=2.0,
            p95_step_latency_ms=140.0,
            sample_note="p95 latency estimated from max (5 spans; reliable p95 needs ≥20).",
        ),
        guardrail_blocked=False,
        guardrail_summary=[],
    )
    save_trace(trace)
    print(f"  Seeded trace {trace_id[:8]}…")
    return trace_id


def seed_feedback(trace_id: str) -> None:
    items = [
        Feedback(
            feedback_id=str(uuid.uuid4()),
            trace_id=trace_id,
            run_id=None,
            signal=FeedbackSignal.THUMBS_UP,
            categories=[],
            note="Very helpful, answered immediately.",
            harness_version="1.0",
            model_version="mock-1.0",
            created_at=_dt(),
        ),
        Feedback(
            feedback_id=str(uuid.uuid4()),
            trace_id=trace_id,
            run_id=None,
            signal=FeedbackSignal.THUMBS_DOWN,
            categories=[FeedbackCategory.INCOMPLETE, FeedbackCategory.BAD_FORMAT],
            note="Response was missing the link to the reset page.",
            harness_version="1.0",
            model_version="mock-1.0",
            created_at=_dt(1),
        ),
    ]
    for fb in items:
        save_feedback(fb)
    print(f"  Seeded {len(items)} feedback items.")


if __name__ == "__main__":
    print("Seeding observability examples…")
    seed_policies()
    trace_id = seed_trace()
    seed_feedback(trace_id)
    print("Done.")
