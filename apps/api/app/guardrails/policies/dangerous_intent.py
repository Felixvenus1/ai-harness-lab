"""Purpose: Dangerous intent detection — flags requests for harmful instructions.

Covers weapons, explosives, drug synthesis, cyberattack tooling, and similar.
Uses pattern matching as a fast first-pass filter.
"""
from __future__ import annotations

import re

from app.guardrails.models import PolicyAction, PolicyConfig, PolicyDecision, PolicyType

_DANGEROUS_PATTERNS = re.compile(
    r"\b("
    r"how\s+to\s+make\s+(?:a\s+)?(?:bomb|weapon|poison|explosive|drug|meth|fentanyl)|"
    r"build\s+(?:a\s+)?(?:bomb|weapon|explosive)|"
    r"make\s+(?:a\s+)?(?:weapon|explosive|poison|bomb)|"
    r"synthesize\s+(?:meth|fentanyl|heroin|cocaine)|"
    r"hack\s+(?:into\s+)?(?:a\s+)?(?:bank|government|hospital|power\s+grid)|"
    r"ddos\s+attack|"
    r"ransomware|"
    r"dangerous\s+weapon|"
    r"child\s+(?:abuse|pornography|exploitation)"
    r")\b",
    re.IGNORECASE,
)


def run(text: str, config: PolicyConfig) -> PolicyDecision:
    match = _DANGEROUS_PATTERNS.search(text)

    if not match:
        return PolicyDecision(
            policy_id=config.policy_id,
            policy_name=config.name,
            policy_type=PolicyType.DANGEROUS_INTENT,
            action_taken=PolicyAction.ALLOW,
            triggered=False,
        )

    return PolicyDecision(
        policy_id=config.policy_id,
        policy_name=config.name,
        policy_type=PolicyType.DANGEROUS_INTENT,
        action_taken=config.action,
        triggered=True,
        reason=f"Dangerous intent detected: '{match.group(0)}'",
    )
