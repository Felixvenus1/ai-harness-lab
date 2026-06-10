"""Purpose: Report generation — per-run summary and comparative reports."""
from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from typing import Any

from harness_core.schemas import BenchmarkRun


def run_summary_json(run: BenchmarkRun) -> dict[str, Any]:
    """Produce a clean metrics summary dict for export."""
    return {
        "run_id": run.id,
        "harness_id": run.harness_id,
        "dataset_id": run.dataset_id,
        "timestamp": run.timestamp.isoformat(),
        "row_count": run.row_count,
        "metrics_config": run.metrics_config,
        "summary": run.summary,
    }


def run_records_csv(run: BenchmarkRun) -> str:
    """Export all per-row records as a CSV string."""
    if not run.records:
        return ""

    output = io.StringIO()
    # Flatten scores dict into columns
    all_score_keys: set[str] = set()
    for rec in run.records:
        all_score_keys.update(rec.scores.keys())
    score_cols = sorted(all_score_keys)

    fieldnames = [
        "row_id", "input", "reference", "output", "group",
        "latency_ms", "input_tokens", "output_tokens", "cost_usd",
        *score_cols,
        "judge_score", "judge_explanation", "error",
    ]

    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for rec in run.records:
        row = rec.model_dump()
        for col in score_cols:
            row[col] = rec.scores.get(col, "")
        row.pop("scores", None)
        writer.writerow(row)

    return output.getvalue()


def comparative_report(run_a: BenchmarkRun, run_b: BenchmarkRun, comparison: dict[str, Any]) -> dict[str, Any]:
    """Produce a structured comparative report between two runs."""
    return {
        "generated_at": datetime.utcnow().isoformat(),
        "run_a": run_summary_json(run_a),
        "run_b": run_summary_json(run_b),
        "bayesian_comparison": comparison,
    }
