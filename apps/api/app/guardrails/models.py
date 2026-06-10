"""Purpose: Pydantic models for policies, decisions, and guardrail results."""
from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PolicyType(str, Enum):
    PII = "pii"
    HATE = "hate"
    DANGEROUS_INTENT = "dangerous_intent"
    PROMPT_INJECTION = "prompt_injection"
    OUTPUT_FORMAT = "output_format"
    SENSITIVE_REDACTION = "sensitive_redaction"


class PolicyAction(str, Enum):
    ALLOW = "allow"
    WARN = "warn"
    BLOCK = "block"
    REDACT = "redact"


# Severity ordering — higher index is more severe.
_ACTION_SEVERITY = [
    PolicyAction.ALLOW,
    PolicyAction.WARN,
    PolicyAction.REDACT,
    PolicyAction.BLOCK,
]


def most_severe_action(actions: list[PolicyAction]) -> PolicyAction:
    """Return the most severe action in a list."""
    if not actions:
        return PolicyAction.ALLOW
    return max(actions, key=lambda a: _ACTION_SEVERITY.index(a))


class PolicyConfig(BaseModel):
    """Configuration for a single policy rule."""

    model_config = ConfigDict(extra="allow")

    policy_id: str
    name: str
    type: PolicyType
    action: PolicyAction
    enabled: bool = True
    # Type-specific parameters (e.g., regex patterns, blocked terms, format schema).
    params: dict[str, Any] = Field(default_factory=dict)


class PolicyDecision(BaseModel):
    """The result of running one policy against a piece of text."""

    policy_id: str
    policy_name: str
    policy_type: PolicyType
    action_taken: PolicyAction
    triggered: bool
    reason: str | None = None
    # Text after redaction; only set when action is REDACT.
    redacted_text: str | None = None


class GuardrailResult(BaseModel):
    """Aggregate result of running all configured policies."""

    decisions: list[PolicyDecision]
    final_action: PolicyAction
    blocked: bool
    # Redacted version of the input/output, if any REDACT policy fired.
    output_text: str | None = None
    # Human-readable explanation sent to the caller when blocked.
    explanation: str | None = None


class PolicyStats(BaseModel):
    """Aggregate policy violation statistics."""

    total_evaluations: int
    block_rate_by_type: dict[str, float]
    redact_rate: float
    warn_rate: float
    # Decisions that were BLOCK or WARN but may need human review.
    false_positive_queue_size: int
    sample_note: str | None = None
