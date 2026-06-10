"""Purpose: FastAPI routes for the evaluation module — all paths prefixed /evaluation."""
from __future__ import annotations

import csv
import io
import json
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from harness_core.schemas import BenchmarkRun, FlowGraph

from evaluation.schemas import (
    CompareRequest,
    DatasetUploadResponse,
    JudgeScoreRequest,
    JudgeScoreResponse,
    PerturbRequest,
    RunStartRequest,
)
from evaluation.storage import (
    list_datasets,
    list_flows,
    list_runs,
    load_dataset,
    load_flow,
    load_run,
    save_dataset,
    save_run,
)
from evaluation.runner import BenchmarkRunner
from evaluation.metrics.robustness import generate_perturbations
from evaluation.stats.bayesian import compare_runs as bayesian_compare
from evaluation.judge.llm_judge import LLMJudge
from evaluation.report import run_records_csv, run_summary_json, comparative_report

router = APIRouter(prefix="/evaluation", tags=["evaluation"])

# ---------------------------------------------------------------------------
# FR-11  Dataset endpoints
# ---------------------------------------------------------------------------


@router.post("/datasets/upload", response_model=DatasetUploadResponse)
async def upload_dataset(file: UploadFile = File(...)) -> DatasetUploadResponse:
    """Parse and store an uploaded CSV or JSON dataset file (max 10MB)."""
    MAX_SIZE = 10 * 1024 * 1024  # 10MB

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 10MB limit.")

    filename = file.filename or "dataset"
    warnings: list[str] = []

    rows: list[dict[str, Any]] = []
    if filename.endswith(".csv"):
        rows = _parse_csv(content.decode("utf-8-sig"))
    elif filename.endswith(".json"):
        rows = _parse_json(content.decode("utf-8"))
    else:
        raise HTTPException(status_code=415, detail="Only CSV and JSON files are supported.")

    if not rows:
        raise HTTPException(status_code=422, detail="Uploaded file contains no rows.")

    # Infer field names
    all_keys = list(rows[0].keys()) if rows else []
    input_field = _detect_field(all_keys, ["input", "prompt", "query", "question"])
    reference_field = _detect_field(all_keys, ["reference", "expected", "answer", "output", "ground_truth"])
    label_field = _detect_field(all_keys, ["label", "class", "category"])
    group_field = _detect_field(all_keys, ["group", "segment", "task_type", "type"])

    if not reference_field:
        warnings.append(
            "'reference' field not detected — judge mode will be required for accuracy metrics."
        )

    # Normalise rows to canonical field names, add row_id
    canonical: list[dict[str, Any]] = []
    for i, row in enumerate(rows):
        canonical.append({
            "row_id": str(uuid.uuid4()),
            "input": str(row.get(input_field or "input", "")),
            "reference": str(row.get(reference_field or "", "")),
            "label": row.get(label_field or "", None),
            "group": row.get(group_field or "", None),
            "metadata": {k: v for k, v in row.items() if k not in {input_field, reference_field, label_field, group_field}},
        })

    # Field type detection and null counts
    field_types = _detect_types(rows)
    null_counts = {k: sum(1 for r in rows if not r.get(k)) for k in all_keys}

    name = filename.replace(".csv", "").replace(".json", "")
    schema = {
        "input_field": input_field or "input",
        "reference_field": reference_field or "",
        "label_field": label_field,
        "group_field": group_field,
    }
    dataset_id = save_dataset(name, canonical, schema)

    return DatasetUploadResponse(
        id=dataset_id,
        name=name,
        row_count=len(canonical),
        input_field=input_field or "input",
        reference_field=reference_field or "",
        label_field=label_field,
        group_field=group_field,
        preview=[{k: v for k, v in r.items() if k != "metadata"} for r in canonical[:10]],
        field_types=field_types,
        null_counts=null_counts,
        warnings=warnings,
    )


@router.get("/datasets")
def get_datasets() -> dict[str, Any]:
    return {"datasets": list_datasets()}


@router.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str) -> dict[str, Any]:
    try:
        return load_dataset(dataset_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id!r} not found.")


# ---------------------------------------------------------------------------
# FR-11  Run endpoints
# ---------------------------------------------------------------------------


@router.post("/runs/start")
def start_run(req: RunStartRequest) -> dict[str, Any]:
    """Start a benchmark run synchronously and return the completed run summary."""
    # Load dataset
    try:
        dataset = load_dataset(req.dataset_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Dataset {req.dataset_id!r} not found.")

    # Load flow graph
    try:
        flow_data = load_flow(req.harness_id)
        graph = FlowGraph.model_validate(flow_data)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Flow {req.harness_id!r} not found.")
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid flow: {exc}") from exc

    rows = dataset.get("rows", [])
    runner = BenchmarkRunner(
        flow_graph=graph,
        dataset_rows=rows,
        metrics=req.metrics,
        concurrency=req.concurrency,
    )

    run = runner.run()
    run = run.model_copy(update={"dataset_id": req.dataset_id})
    save_run(run)

    return {"run_id": run.id, "summary": run.summary, "row_count": run.row_count}


@router.get("/runs")
def get_runs() -> dict[str, Any]:
    return {"runs": list_runs()}


@router.get("/runs/{run_id}")
def get_run(run_id: str) -> dict[str, Any]:
    try:
        run = load_run(run_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Run {run_id!r} not found.")
    return run_summary_json(run)


@router.get("/runs/{run_id}/records")
def get_run_records(run_id: str, page: int = 1, page_size: int = 50) -> dict[str, Any]:
    try:
        run = load_run(run_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Run {run_id!r} not found.")
    start = (page - 1) * page_size
    end = start + page_size
    records = [r.model_dump() for r in run.records[start:end]]
    return {
        "run_id": run_id,
        "page": page,
        "page_size": page_size,
        "total": run.row_count,
        "records": records,
    }


@router.get("/runs/{run_id}/export/csv")
def export_run_csv(run_id: str) -> StreamingResponse:
    try:
        run = load_run(run_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Run {run_id!r} not found.")
    csv_content = run_records_csv(run)
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="run_{run_id}.csv"'},
    )


# ---------------------------------------------------------------------------
# FR-11  Compare endpoint
# ---------------------------------------------------------------------------


@router.post("/compare")
def compare(req: CompareRequest) -> dict[str, Any]:
    """Run Bayesian comparison between two saved runs."""
    try:
        run_a = load_run(req.run_a_id)
        run_b = load_run(req.run_b_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    results: dict[str, Any] = {}

    for metric in req.metrics:
        if metric == "accuracy":
            s_a = sum(1 for r in run_a.records if r.scores.get("exact_match", 0) > 0.5)
            s_b = sum(1 for r in run_b.records if r.scores.get("exact_match", 0) > 0.5)
            comparison = bayesian_compare(
                s_a, run_a.row_count, s_b, run_b.row_count, req.rope_delta
            )
            results[metric] = comparison
        else:
            # Continuous metric comparison using mean as proxy
            def _get_values(run: BenchmarkRun, m: str) -> list[float]:
                if m == "latency_ms":
                    return [r.latency_ms for r in run.records]
                if m == "cost_usd":
                    return [r.cost_usd for r in run.records]
                return [r.scores.get(m, 0.0) for r in run.records]

            vals_a = _get_values(run_a, metric)
            vals_b = _get_values(run_b, metric)
            if not vals_a or not vals_b:
                continue
            mean_a = sum(vals_a) / len(vals_a)
            mean_b = sum(vals_b) / len(vals_b)
            results[metric] = {
                "mean_a": round(mean_a, 4),
                "mean_b": round(mean_b, 4),
                "delta": round(mean_a - mean_b, 4),
                "relative_change": round((mean_a - mean_b) / max(mean_b, 1e-9), 4),
            }

    full_comparison = results
    report = comparative_report(run_a, run_b, full_comparison)
    return report


# ---------------------------------------------------------------------------
# FR-11  Judge endpoint
# ---------------------------------------------------------------------------


@router.post("/judge/score", response_model=JudgeScoreResponse)
def judge_score(req: JudgeScoreRequest) -> JudgeScoreResponse:
    judge = LLMJudge(provider_name=req.provider, model=req.model, scale=req.scale)
    result = judge.score_pointwise(req.input, req.output, req.rubric, req.scale, req.reference)
    return JudgeScoreResponse(
        score=result["score"],
        explanation=result["explanation"],
        raw_response=result["raw_response"],
    )


# ---------------------------------------------------------------------------
# FR-11  Perturbation endpoint
# ---------------------------------------------------------------------------


@router.post("/perturb")
def perturb(req: PerturbRequest) -> dict[str, Any]:
    variants = generate_perturbations(
        req.input, req.strategies, req.n_variants, req.typo_rate
    )
    return {"original": req.input, "variants": variants}


# ---------------------------------------------------------------------------
# FR-11  Flows endpoint (for the runner UI)
# ---------------------------------------------------------------------------


@router.get("/flows")
def get_flows() -> dict[str, Any]:
    return {"flows": list_flows()}


@router.post("/flows")
def save_flow_endpoint(flow: dict[str, Any]) -> dict[str, Any]:
    from evaluation.storage import save_flow

    flow_id = save_flow(flow)
    return {"id": flow_id}


# ---------------------------------------------------------------------------
# FR-11  Metric definitions endpoint
# ---------------------------------------------------------------------------


@router.get("/metrics/definitions")
def get_metric_definitions() -> dict[str, Any]:
    return {
        "metrics": [
            {"name": "exact_match", "description": "Binary match after normalisation (lowercase, strip punctuation).", "task_types": ["extraction", "classification"]},
            {"name": "token_f1", "description": "Token-level precision/recall/F1 over shared tokens.", "task_types": ["extraction", "qa"]},
            {"name": "bleu", "description": "BLEU-1 to BLEU-4 with brevity penalty. Precision-focused.", "task_types": ["translation", "generation"]},
            {"name": "rouge_l", "description": "Longest common subsequence recall. Recall-focused.", "task_types": ["summarisation"]},
            {"name": "bertscore_f1", "description": "Contextual token-level cosine similarity using sentence-transformers. Best for open-ended generation.", "task_types": ["generation", "summarisation", "translation"]},
            {"name": "semantic_similarity", "description": "Sentence-level cosine similarity in [0,1]. Continuous quality signal.", "task_types": ["all"]},
            {"name": "latency_ms", "description": "End-to-end latency in milliseconds.", "task_types": ["all"]},
            {"name": "cost_usd", "description": "Estimated USD cost per request.", "task_types": ["all"]},
        ]
    }


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------


def _parse_csv(content: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(content))
    return [dict(row) for row in reader]


def _parse_json(content: str) -> list[dict[str, Any]]:
    data = json.loads(content)
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "rows" in data:
        return data["rows"]
    raise ValueError("JSON must be an array of objects or have a 'rows' key.")


def _detect_field(keys: list[str], candidates: list[str]) -> str | None:
    for c in candidates:
        for k in keys:
            if k.lower() == c.lower():
                return k
    return None


def _detect_types(rows: list[dict[str, Any]]) -> dict[str, str]:
    if not rows:
        return {}
    types: dict[str, str] = {}
    for key in rows[0]:
        vals = [r.get(key) for r in rows if r.get(key) is not None]
        if not vals:
            types[key] = "null"
        elif all(isinstance(v, bool) for v in vals):
            types[key] = "boolean"
        elif all(isinstance(v, (int, float)) for v in vals):
            types[key] = "number"
        else:
            types[key] = "string"
    return types
