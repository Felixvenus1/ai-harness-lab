"""Purpose: PII detection policy — finds common personal data patterns in text.

Uses regex-based detection for emails, phone numbers, SSNs, and credit cards.
For production-grade PII detection, swap this for a dedicated library such as
presidio or spacy-based NER.  This implementation keeps it dependency-free and
understandable.
"""
from __future__ import annotations

import re

from app.guardrails.models import PolicyAction, PolicyConfig, PolicyDecision, PolicyType

# Pattern library — each entry is (name, compiled_regex, redact_placeholder)
_PII_PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    ("email", re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b"), "[EMAIL]"),
    ("phone_us", re.compile(r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"), "[PHONE]"),
    ("ssn", re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[SSN]"),
    ("credit_card", re.compile(r"\b(?:\d[ -]?){13,16}\b"), "[CARD]"),
    ("ipv4", re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"), "[IP]"),
]


def run(text: str, config: PolicyConfig) -> PolicyDecision:
    """Check text for PII patterns and return a decision."""
    found: list[str] = []
    redacted = text

    for name, pattern, placeholder in _PII_PATTERNS:
        if pattern.search(text):
            found.append(name)
            if config.action == PolicyAction.REDACT:
                redacted = pattern.sub(placeholder, redacted)

    if not found:
        return PolicyDecision(
            policy_id=config.policy_id,
            policy_name=config.name,
            policy_type=PolicyType.PII,
            action_taken=PolicyAction.ALLOW,
            triggered=False,
        )

    return PolicyDecision(
        policy_id=config.policy_id,
        policy_name=config.name,
        policy_type=PolicyType.PII,
        action_taken=config.action,
        triggered=True,
        reason=f"PII detected: {', '.join(found)}",
        redacted_text=redacted if config.action == PolicyAction.REDACT else None,
    )
