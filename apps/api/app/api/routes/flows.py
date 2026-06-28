"""Purpose: CRUD for saved flow graphs — POST /flows, GET /flows, GET /flows/{id}, DELETE /flows/{id}."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from harness_core.schemas import FlowGraph

router = APIRouter(prefix="/flows", tags=["flows"])

_API_ROOT = Path(__file__).parent.parent.parent.parent  # apps/api/
_FLOWS_DIR = _API_ROOT / "data" / "flows"


def _ensure_dir() -> None:
    _FLOWS_DIR.mkdir(parents=True, exist_ok=True)


# ── Response models ──────────────────────────────────────────────────────────


class SavedFlowMeta(BaseModel):
    """Lightweight summary returned in list responses."""
    id: str
    name: str
    node_count: int
    edge_count: int
    saved_at: str


class SavedFlow(SavedFlowMeta):
    """Full saved flow including the graph payload."""
    graph: FlowGraph


class SaveFlowRequest(BaseModel):
    graph: FlowGraph
    # Optionally override the name stored with the flow
    name: str | None = None


# ── Helpers ──────────────────────────────────────────────────────────────────


def _flow_path(flow_id: str) -> Path:
    return _FLOWS_DIR / f"{flow_id}.json"


def _load_record(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _to_meta(record: dict) -> SavedFlowMeta:
    return SavedFlowMeta(
        id=record["id"],
        name=record["name"],
        node_count=record["node_count"],
        edge_count=record["edge_count"],
        saved_at=record["saved_at"],
    )


# ── Routes ───────────────────────────────────────────────────────────────────


@router.post("", response_model=SavedFlowMeta, status_code=201)
def save_flow(req: SaveFlowRequest) -> SavedFlowMeta:
    """Persist a flow graph. Creates a new ID unless the graph already has one."""
    _ensure_dir()
    graph = req.graph
    flow_id = graph.id or str(uuid.uuid4())
    name = req.name or graph.name or "Untitled Flow"

    record = {
        "id": flow_id,
        "name": name,
        "node_count": len(graph.nodes),
        "edge_count": len(graph.edges),
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "graph": graph.model_dump(),
    }
    _flow_path(flow_id).write_text(json.dumps(record, indent=2), encoding="utf-8")
    return _to_meta(record)


@router.get("", response_model=list[SavedFlowMeta])
def list_flows() -> list[SavedFlowMeta]:
    """Return metadata for all saved flows, newest first."""
    _ensure_dir()
    paths = sorted(_FLOWS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    metas: list[SavedFlowMeta] = []
    for path in paths:
        try:
            metas.append(_to_meta(_load_record(path)))
        except Exception:  # noqa: BLE001
            pass
    return metas


@router.get("/{flow_id}", response_model=SavedFlow)
def get_flow(flow_id: str) -> SavedFlow:
    """Load a full saved flow by ID."""
    path = _flow_path(flow_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"flow '{flow_id}' not found")
    record = _load_record(path)
    return SavedFlow(graph=FlowGraph.model_validate(record["graph"]), **_to_meta(record).model_dump())


@router.delete("/{flow_id}", status_code=204)
def delete_flow(flow_id: str) -> None:
    """Delete a saved flow by ID."""
    path = _flow_path(flow_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"flow '{flow_id}' not found")
    path.unlink()
