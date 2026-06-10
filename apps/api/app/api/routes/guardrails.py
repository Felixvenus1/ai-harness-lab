"""Purpose: Guardrail policy endpoints — manage policy configs and run ad-hoc checks."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.guardrails.engine import GuardrailEngine
from app.guardrails.models import GuardrailResult, PolicyConfig, PolicyStats
from app.guardrails.storage import (
    compute_policy_stats,
    delete_policy,
    list_policies,
    load_policy,
    save_policy,
)

router = APIRouter(prefix="/guardrails", tags=["guardrails"])


# ---------------------------------------------------------------------------
# Policy config CRUD
# ---------------------------------------------------------------------------


@router.get("/policies", response_model=list[PolicyConfig])
def get_policies() -> list[PolicyConfig]:
    """List all configured policies."""
    return list_policies()


@router.post("/policies", response_model=PolicyConfig, status_code=201)
def create_policy(body: PolicyConfig) -> PolicyConfig:
    """Create or replace a policy configuration."""
    if not body.policy_id:
        body = body.model_copy(update={"policy_id": str(uuid.uuid4())})
    save_policy(body)
    return body


@router.put("/policies/{policy_id}", response_model=PolicyConfig)
def update_policy(policy_id: str, body: PolicyConfig) -> PolicyConfig:
    """Update an existing policy (full replacement)."""
    body = body.model_copy(update={"policy_id": policy_id})
    save_policy(body)
    return body


@router.delete("/policies/{policy_id}", status_code=204)
def remove_policy(policy_id: str) -> None:
    """Delete a policy by ID."""
    try:
        load_policy(policy_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Policy {policy_id!r} not found.")
    delete_policy(policy_id)


# ---------------------------------------------------------------------------
# Ad-hoc guardrail check
# ---------------------------------------------------------------------------


class CheckRequest(BaseModel):
    text: str
    policy_ids: list[str] = []  # Empty = run all enabled policies


@router.post("/check", response_model=GuardrailResult)
def check_text(body: CheckRequest) -> GuardrailResult:
    """Run guardrail policies against arbitrary text and return decisions."""
    if body.policy_ids:
        policies = []
        for pid in body.policy_ids:
            try:
                policies.append(load_policy(pid))
            except FileNotFoundError:
                raise HTTPException(status_code=404, detail=f"Policy {pid!r} not found.")
    else:
        policies = list_policies()

    engine = GuardrailEngine(policies)
    return engine.run(body.text)


# ---------------------------------------------------------------------------
# Policy statistics
# ---------------------------------------------------------------------------


@router.get("/stats", response_model=PolicyStats)
def get_policy_stats() -> PolicyStats:
    """Return aggregate block/redact rates derived from the violations log."""
    return compute_policy_stats()
