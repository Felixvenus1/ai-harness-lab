"""Purpose: Output format validation — checks that model output satisfies a schema.

Supported checks:
- json_required: output must be valid JSON
- required_fields: JSON output must contain all listed keys
- max_length: output must not exceed character limit
"""
from __future__ import annotations

import json

from app.guardrails.models import PolicyAction, PolicyConfig, PolicyDecision, PolicyType


def run(text: str, config: PolicyConfig) -> PolicyDecision:
    params = config.params
    violations: list[str] = []

    # Check 1: must be valid JSON
    if params.get("json_required", False):
        try:
            parsed = json.loads(text)
        except (json.JSONDecodeError, ValueError):
            parsed = None
            violations.append("output is not valid JSON")

        if parsed is not None:
            required_fields: list[str] = params.get("required_fields", [])
            if required_fields and isinstance(parsed, dict):
                missing = [f for f in required_fields if f not in parsed]
                if missing:
                    violations.append(f"missing required fields: {missing}")

    # Check 2: max length
    max_len: int | None = params.get("max_length")
    if max_len is not None and len(text) > max_len:
        violations.append(f"output length {len(text)} exceeds max {max_len}")

    if not violations:
        return PolicyDecision(
            policy_id=config.policy_id,
            policy_name=config.name,
            policy_type=PolicyType.OUTPUT_FORMAT,
            action_taken=PolicyAction.ALLOW,
            triggered=False,
        )

    return PolicyDecision(
        policy_id=config.policy_id,
        policy_name=config.name,
        policy_type=PolicyType.OUTPUT_FORMAT,
        action_taken=config.action,
        triggered=True,
        reason="; ".join(violations),
    )
