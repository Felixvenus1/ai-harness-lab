"""Purpose: Dataset and run persistence helpers — read/write JSON files to data/."""
from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any

from harness_core.schemas import BenchmarkRun

# ---------------------------------------------------------------------------
# Storage root — resolved relative to the API app root
# ---------------------------------------------------------------------------
_API_ROOT = Path(__file__).parent.parent  # apps/api/
_DATA_ROOT = _API_ROOT / "data"
_DATASETS_DIR = _DATA_ROOT / "datasets"
_RUNS_DIR = _DATA_ROOT / "runs"
_FLOWS_DIR = _DATA_ROOT / "flows"


def _ensure_dirs() -> None:
    _DATASETS_DIR.mkdir(parents=True, exist_ok=True)
    _RUNS_DIR.mkdir(parents=True, exist_ok=True)
    _FLOWS_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Dataset persistence
# ---------------------------------------------------------------------------


def save_dataset(name: str, rows: list[dict[str, Any]], schema: dict[str, Any]) -> str:
    """Persist a dataset and return its UUID."""
    _ensure_dirs()
    dataset_id = str(uuid.uuid4())
    payload = {"id": dataset_id, "name": name, "schema": schema, "rows": rows}
    path = _DATASETS_DIR / f"{dataset_id}.json"
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return dataset_id


def load_dataset(dataset_id: str) -> dict[str, Any]:
    """Load a dataset by ID. Raises FileNotFoundError if missing."""
    path = _DATASETS_DIR / f"{dataset_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"dataset {dataset_id!r} not found")
    return json.loads(path.read_text(encoding="utf-8"))


def list_datasets() -> list[dict[str, Any]]:
    """Return metadata (without rows) for all saved datasets."""
    _ensure_dirs()
    result = []
    for p in sorted(_DATASETS_DIR.glob("*.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            result.append({
                "id": data["id"],
                "name": data.get("name", ""),
                "row_count": len(data.get("rows", [])),
                "schema": data.get("schema", {}),
            })
        except Exception:  # noqa: BLE001
            pass
    return result


# ---------------------------------------------------------------------------
# Run persistence
# ---------------------------------------------------------------------------


def save_run(run: BenchmarkRun) -> None:
    """Persist a BenchmarkRun to disk."""
    _ensure_dirs()
    path = _RUNS_DIR / f"{run.id}.json"
    path.write_text(run.model_dump_json(indent=2), encoding="utf-8")


def load_run(run_id: str) -> BenchmarkRun:
    """Load a BenchmarkRun by ID."""
    path = _RUNS_DIR / f"{run_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"run {run_id!r} not found")
    return BenchmarkRun.model_validate_json(path.read_text(encoding="utf-8"))


def list_runs(limit: int = 100) -> list[dict[str, Any]]:
    """Return summary metadata for all saved runs (most recent first)."""
    _ensure_dirs()
    result = []
    paths = sorted(_RUNS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    for p in paths[:limit]:
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            result.append({
                "id": data["id"],
                "harness_id": data.get("harness_id", ""),
                "dataset_id": data.get("dataset_id", ""),
                "timestamp": data.get("timestamp", ""),
                "row_count": data.get("row_count", 0),
                "metrics_config": data.get("metrics_config", []),
                "top_metrics": _extract_top_metrics(data.get("summary", {})),
            })
        except Exception:  # noqa: BLE001
            pass
    return result


def _extract_top_metrics(summary: dict[str, Any]) -> dict[str, Any]:
    top: dict[str, Any] = {}
    if "accuracy" in summary:
        top["exact_match_rate"] = summary["accuracy"].get("exact_match_rate")
        bayes = summary["accuracy"].get("bayesian", {})
        top["posterior_mean_accuracy"] = bayes.get("posterior_mean")
    if "cost" in summary:
        top["total_cost_usd"] = summary["cost"].get("total_cost_usd")
        top["mean_cost_per_request_usd"] = summary["cost"].get("mean_cost_per_request_usd")
    if "latency" in summary:
        top["latency_p50_ms"] = summary["latency"].get("p50")
        top["latency_p95_ms"] = summary["latency"].get("p95")
    return top


# ---------------------------------------------------------------------------
# Flow persistence (saved harness flows)
# ---------------------------------------------------------------------------


def save_flow(flow: dict[str, Any]) -> str:
    """Persist a flow graph and return its ID."""
    _ensure_dirs()
    flow_id = flow.get("id") or str(uuid.uuid4())
    flow["id"] = flow_id
    path = _FLOWS_DIR / f"{flow_id}.json"
    path.write_text(json.dumps(flow, indent=2), encoding="utf-8")
    return flow_id


def load_flow(flow_id: str) -> dict[str, Any]:
    """Load a saved flow by ID."""
    path = _FLOWS_DIR / f"{flow_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"flow {flow_id!r} not found")
    return json.loads(path.read_text(encoding="utf-8"))


def list_flows() -> list[dict[str, Any]]:
    """Return all saved flows."""
    _ensure_dirs()
    result = []
    for p in sorted(_FLOWS_DIR.glob("*.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            result.append({"id": data.get("id", ""), "name": data.get("name", "")})
        except Exception:  # noqa: BLE001
            pass
    return result
