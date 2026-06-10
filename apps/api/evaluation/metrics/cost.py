"""Purpose: Token counting, cost-per-run, cost-per-correct, cost distribution."""
from __future__ import annotations

import statistics
from typing import Any


# ---------------------------------------------------------------------------
# FR-5.1  Per-run cost aggregation
# ---------------------------------------------------------------------------


def per_run_cost(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate cost metrics across all records in a run."""
    costs = [r.get("cost_usd", 0.0) for r in records]
    correct = [r for r in records if r.get("scores", {}).get("exact_match", 0) > 0.5]

    total = sum(costs)
    mean = total / len(costs) if costs else 0.0
    cost_per_correct = total / len(correct) if correct else float("inf")

    return {
        "total_cost_usd": round(total, 6),
        "mean_cost_per_request_usd": round(mean, 6),
        "cost_per_correct_usd": round(cost_per_correct, 6) if cost_per_correct != float("inf") else None,
        "n_correct": len(correct),
    }


# ---------------------------------------------------------------------------
# FR-5.3  Token breakdown
# ---------------------------------------------------------------------------


def token_breakdown(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute percentile statistics for input/output token counts."""
    input_tokens = sorted(r.get("input_tokens", 0) for r in records)
    output_tokens = sorted(r.get("output_tokens", 0) for r in records)

    def _stats(vals: list[int]) -> dict[str, float]:
        if not vals:
            return {}
        n = len(vals)
        mean = statistics.mean(vals)
        stdev = statistics.stdev(vals) if n > 1 else 0.0
        return {
            "mean": round(mean, 1),
            "p50": _pct(vals, 50),
            "p90": _pct(vals, 90),
            "p99": _pct(vals, 99),
            "stdev": round(stdev, 1),
            "outlier_threshold": round(mean + 2 * stdev, 1),
        }

    def _pct(sorted_vals: list[int], p: int) -> float:
        if not sorted_vals:
            return 0.0
        idx = max(0, int(len(sorted_vals) * p / 100) - 1)
        return float(sorted_vals[idx])

    result = {
        "input_tokens": _stats(input_tokens),
        "output_tokens": _stats(output_tokens),
    }

    # Flag outlier rows
    all_inputs = [r.get("input_tokens", 0) for r in records]
    if all_inputs:
        mean_in = statistics.mean(all_inputs)
        stdev_in = statistics.stdev(all_inputs) if len(all_inputs) > 1 else 0.0
        threshold = mean_in + 2 * stdev_in
        result["outlier_row_ids"] = [
            r["row_id"] for r in records if r.get("input_tokens", 0) > threshold
        ]

    return result


# ---------------------------------------------------------------------------
# FR-5.2  Cost-quality frontier (multi-run)
# ---------------------------------------------------------------------------


def cost_quality_frontier(run_summaries: list[dict[str, Any]]) -> dict[str, Any]:
    """Identify Pareto-efficient runs given cost and quality metrics.

    Each run_summary must have: id, mean_cost_per_request_usd, mean_accuracy.
    """
    points = [
        {
            "id": s["id"],
            "cost": s.get("mean_cost_per_request_usd", 0.0),
            "quality": s.get("mean_accuracy", 0.0),
        }
        for s in run_summaries
    ]

    pareto: list[str] = []
    for p in points:
        dominated = any(
            q["cost"] <= p["cost"] and q["quality"] >= p["quality"] and q["id"] != p["id"]
            for q in points
        )
        if not dominated:
            pareto.append(p["id"])

    return {"points": points, "pareto_run_ids": pareto}
