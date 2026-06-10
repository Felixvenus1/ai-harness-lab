"""Purpose: Prompt injection detection — flags attempts to override system instructions.

Looks for classic injection phrases that try to hijack the model's behaviour.
"""
from __future__ import annotations

import re

from app.guardrails.models import PolicyAction, PolicyConfig, PolicyDecision, PolicyType

_INJECTION_PATTERNS = re.compile(
    r"("
    r"ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?|"
    r"disregard\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?|"
    r"forget\s+(?:everything|all)\s+(?:you\s+)?(?:were\s+)?told|"
    r"you\s+are\s+now\s+(?:a\s+)?(?:different|new|uncensored)\s+(?:AI|model|assistant)|"
    r"act\s+as\s+(?:if\s+you\s+(?:have\s+)?no\s+restrictions?|DAN|evil|jailbreak)|"
    r"pretend\s+you\s+(?:have\s+)?no\s+rules?|"
    r"system\s*:\s*(?:you\s+are|new\s+instructions?)|"
    r"<\s*/?system\s*>|"
    r"\[INST\].*\[/INST\]"
    r")",
    re.IGNORECASE | re.DOTALL,
)


def run(text: str, config: PolicyConfig) -> PolicyDecision:
    match = _INJECTION_PATTERNS.search(text)

    if not match:
        return PolicyDecision(
            policy_id=config.policy_id,
            policy_name=config.name,
            policy_type=PolicyType.PROMPT_INJECTION,
            action_taken=PolicyAction.ALLOW,
            triggered=False,
        )

    return PolicyDecision(
        policy_id=config.policy_id,
        policy_name=config.name,
        policy_type=PolicyType.PROMPT_INJECTION,
        action_taken=config.action,
        triggered=True,
        reason="Prompt injection attempt detected.",
    )
