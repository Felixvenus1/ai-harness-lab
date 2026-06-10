"""Purpose: Composable policy engine — chains multiple policies and returns a GuardrailResult.

Usage:
    engine = GuardrailEngine(policy_configs)
    result = engine.run(text)

The engine runs all enabled policies in order, collects decisions, and returns
the most severe action.  If any policy blocks, the result carries a structured
explanation.  If any policy redacts, the returned output_text reflects all
applied redactions.
"""
from __future__ import annotations

from app.guardrails.models import (
    GuardrailResult,
    PolicyAction,
    PolicyConfig,
    PolicyDecision,
    PolicyType,
    most_severe_action,
)
from app.guardrails.policies import (
    dangerous_intent,
    hate,
    injection,
    output_format,
    pii,
    redaction,
)

# Dispatch table: PolicyType -> module with a run(text, config) function.
_POLICY_RUNNERS = {
    PolicyType.PII: pii,
    PolicyType.HATE: hate,
    PolicyType.DANGEROUS_INTENT: dangerous_intent,
    PolicyType.PROMPT_INJECTION: injection,
    PolicyType.OUTPUT_FORMAT: output_format,
    PolicyType.SENSITIVE_REDACTION: redaction,
}


class GuardrailEngine:
    """Run a list of policy configs against a piece of text."""

    def __init__(self, policies: list[PolicyConfig]) -> None:
        self.policies = [p for p in policies if p.enabled]

    def run(self, text: str) -> GuardrailResult:
        """Evaluate all enabled policies and return an aggregate result."""
        decisions: list[PolicyDecision] = []
        current_text = text  # May be mutated by REDACT policies.

        for config in self.policies:
            runner = _POLICY_RUNNERS.get(config.type)
            if runner is None:
                continue  # Unknown policy type — skip silently.

            decision = runner.run(current_text, config)
            decisions.append(decision)

            # Apply redactions immediately so downstream policies see the
            # already-redacted text (prevents double-triggering on same term).
            if decision.action_taken == PolicyAction.REDACT and decision.redacted_text is not None:
                current_text = decision.redacted_text

        triggered = [d for d in decisions if d.triggered]
        all_actions = [d.action_taken for d in triggered] if triggered else [PolicyAction.ALLOW]
        final_action = most_severe_action(all_actions)
        blocked = final_action == PolicyAction.BLOCK

        explanation: str | None = None
        if blocked:
            reasons = "; ".join(d.reason for d in triggered if d.reason)
            explanation = (
                f"Request blocked by policy guardrail(s). Reason(s): {reasons}"
                if reasons
                else "Request blocked by policy guardrail."
            )

        return GuardrailResult(
            decisions=decisions,
            final_action=final_action,
            blocked=blocked,
            output_text=current_text if current_text != text else None,
            explanation=explanation,
        )
