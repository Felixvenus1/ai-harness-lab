"""Purpose: Sensitive data redaction — replaces configurable terms with a placeholder.

Useful for stripping internal project names, internal URLs, API keys accidentally
echoed in prompts, or any domain-specific sensitive strings.

The sensitive terms are provided via policy params:
  {"terms": ["internal-api-key", "project-codename", ...], "placeholder": "[REDACTED]"}
"""
from __future__ import annotations

import re

from app.guardrails.models import PolicyAction, PolicyConfig, PolicyDecision, PolicyType


def run(text: str, config: PolicyConfig) -> PolicyDecision:
    terms: list[str] = config.params.get("terms", [])
    placeholder: str = config.params.get("placeholder", "[REDACTED]")

    if not terms:
        return PolicyDecision(
            policy_id=config.policy_id,
            policy_name=config.name,
            policy_type=PolicyType.SENSITIVE_REDACTION,
            action_taken=PolicyAction.ALLOW,
            triggered=False,
            reason="No sensitive terms configured.",
        )

    found: list[str] = []
    redacted = text
    for term in terms:
        if not term:
            continue
        pattern = re.compile(re.escape(term), re.IGNORECASE)
        if pattern.search(text):
            found.append(term)
            if config.action == PolicyAction.REDACT:
                redacted = pattern.sub(placeholder, redacted)

    if not found:
        return PolicyDecision(
            policy_id=config.policy_id,
            policy_name=config.name,
            policy_type=PolicyType.SENSITIVE_REDACTION,
            action_taken=PolicyAction.ALLOW,
            triggered=False,
        )

    return PolicyDecision(
        policy_id=config.policy_id,
        policy_name=config.name,
        policy_type=PolicyType.SENSITIVE_REDACTION,
        action_taken=config.action,
        triggered=True,
        reason=f"Sensitive term(s) found: {found}",
        redacted_text=redacted if config.action == PolicyAction.REDACT else None,
    )
