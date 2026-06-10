"""Purpose: Hate / harassment detection policy — keyword and phrase-based.

Flags content containing slurs, threats, or dehumanising language.
For production use, supplement with a classifier (e.g., Perspective API or
a fine-tuned moderation model).  This implementation is purely lexical and
intentionally conservative to avoid false negatives.
"""
from __future__ import annotations

import re

from app.guardrails.models import PolicyAction, PolicyConfig, PolicyDecision, PolicyType

# Lower-cased terms / short phrases that signal hate or harassment.
# This list is deliberately minimal — extend via policy params in production.
_DEFAULT_HATE_TERMS = [
    "kill yourself",
    "kys",
    "go die",
    "i will hurt you",
    "i will kill",
    "rape",
    "lynch",
    "exterminate",
    "genocide",
    "death threat",
]


def _build_pattern(extra_terms: list[str]) -> re.Pattern[str]:
    terms = _DEFAULT_HATE_TERMS + extra_terms
    escaped = [re.escape(t) for t in terms]
    return re.compile(r"\b(?:" + "|".join(escaped) + r")\b", re.IGNORECASE)


def run(text: str, config: PolicyConfig) -> PolicyDecision:
    extra: list[str] = config.params.get("extra_terms", [])
    pattern = _build_pattern(extra)
    match = pattern.search(text)

    if not match:
        return PolicyDecision(
            policy_id=config.policy_id,
            policy_name=config.name,
            policy_type=PolicyType.HATE,
            action_taken=PolicyAction.ALLOW,
            triggered=False,
        )

    return PolicyDecision(
        policy_id=config.policy_id,
        policy_name=config.name,
        policy_type=PolicyType.HATE,
        action_taken=config.action,
        triggered=True,
        reason=f"Hate/harassment content detected: '{match.group(0)}'",
    )
