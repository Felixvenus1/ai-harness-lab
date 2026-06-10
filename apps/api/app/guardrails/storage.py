"""Purpose: File-based persistence for policy configurations and violation log."""
from __future__ import annotations

import json
import uuid
from pathlib import Path

from app.guardrails.models import PolicyAction, PolicyConfig, PolicyDecision, PolicyStats, PolicyType

_API_ROOT = Path(__file__).parent.parent.parent  # apps/api/
_POLICY_DIR = _API_ROOT / "data" / "policies"
_VIOLATIONS_DIR = _API_ROOT / "data" / "policy_violations"


def _ensure_dirs() -> None:
    _POLICY_DIR.mkdir(parents=True, exist_ok=True)
    _VIOLATIONS_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Policy config persistence
# ---------------------------------------------------------------------------


def save_policy(config: PolicyConfig) -> None:
    _ensure_dirs()
    path = _POLICY_DIR / f"{config.policy_id}.json"
    path.write_text(config.model_dump_json(indent=2), encoding="utf-8")


def load_policy(policy_id: str) -> PolicyConfig:
    path = _POLICY_DIR / f"{policy_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"policy {policy_id!r} not found")
    return PolicyConfig.model_validate_json(path.read_text(encoding="utf-8"))


def delete_policy(policy_id: str) -> None:
    path = _POLICY_DIR / f"{policy_id}.json"
    if path.exists():
        path.unlink()


def list_policies() -> list[PolicyConfig]:
    _ensure_dirs()
    configs: list[PolicyConfig] = []
    for p in sorted(_POLICY_DIR.glob("*.json")):
        try:
            configs.append(PolicyConfig.model_validate_json(p.read_text(encoding="utf-8")))
        except Exception:  # noqa: BLE001
            pass
    return configs


# ---------------------------------------------------------------------------
# Violation logging — a lightweight append-only log for statistics
# ---------------------------------------------------------------------------


def log_violation(
    trace_id: str,
    decisions: list[PolicyDecision],
) -> None:
    """Persist triggered policy decisions for offline analysis."""
    _ensure_dirs()
    for decision in decisions:
        if not decision.triggered:
            continue
        record = {
            "id": str(uuid.uuid4()),
            "trace_id": trace_id,
            "policy_id": decision.policy_id,
            "policy_type": decision.policy_type.value,
            "action_taken": decision.action_taken.value,
            "reason": decision.reason,
        }
        log_path = _VIOLATIONS_DIR / f"{record['id']}.json"
        log_path.write_text(json.dumps(record, indent=2), encoding="utf-8")


def compute_policy_stats() -> PolicyStats:
    """Derive aggregate statistics from the violations log."""
    _ensure_dirs()
    records: list[dict] = []
    for p in _VIOLATIONS_DIR.glob("*.json"):
        try:
            records.append(json.loads(p.read_text(encoding="utf-8")))
        except Exception:  # noqa: BLE001
            pass

    total = len(records)
    if total == 0:
        return PolicyStats(
            total_evaluations=0,
            block_rate_by_type={},
            redact_rate=0.0,
            warn_rate=0.0,
            false_positive_queue_size=0,
            sample_note="No policy violation data recorded yet.",
        )

    blocked = [r for r in records if r.get("action_taken") == "block"]
    redacted = [r for r in records if r.get("action_taken") == "redact"]
    warned = [r for r in records if r.get("action_taken") == "warn"]

    block_by_type: dict[str, float] = {}
    for ptype in PolicyType:
        type_total = sum(1 for r in records if r.get("policy_type") == ptype.value)
        type_blocked = sum(
            1 for r in blocked if r.get("policy_type") == ptype.value
        )
        if type_total:
            block_by_type[ptype.value] = round(type_blocked / type_total, 4)

    note = f"Statistics from {total} violation event(s)." if total < 20 else None

    return PolicyStats(
        total_evaluations=total,
        block_rate_by_type=block_by_type,
        redact_rate=round(len(redacted) / total, 4),
        warn_rate=round(len(warned) / total, 4),
        false_positive_queue_size=len(blocked) + len(warned),
        sample_note=note,
    )
