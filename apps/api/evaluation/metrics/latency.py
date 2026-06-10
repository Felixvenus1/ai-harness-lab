"""Purpose: Latency distributions, percentiles, outlier detection, distribution fitting."""
from __future__ import annotations

import math
import statistics
from typing import Any


# ---------------------------------------------------------------------------
# FR-6.1  Summary statistics
# ---------------------------------------------------------------------------


def latency_summary(latencies_ms: list[float]) -> dict[str, float]:
    """Compute summary statistics for a list of latency values."""
    if not latencies_ms:
        return {}
    s = sorted(latencies_ms)
    n = len(s)
    mean = statistics.mean(s)
    stdev = statistics.stdev(s) if n > 1 else 0.0
    cv = stdev / mean if mean > 0 else 0.0

    def pct(p: int) -> float:
        idx = max(0, int(n * p / 100) - 1)
        return round(s[idx], 2)

    return {
        "mean": round(mean, 2),
        "median": round(statistics.median(s), 2),
        "p50": pct(50),
        "p75": pct(75),
        "p90": pct(90),
        "p95": pct(95),
        "p99": pct(99),
        "stdev": round(stdev, 2),
        "cv": round(cv, 4),
    }


# ---------------------------------------------------------------------------
# FR-6.2  Distribution fitting (log-normal, Weibull, gamma)
# ---------------------------------------------------------------------------


def fit_distributions(latencies_ms: list[float]) -> dict[str, Any]:
    """Fit parametric distributions and return AIC-based best fit."""
    try:
        from scipy import stats as scipy_stats  # type: ignore
        import numpy as np  # type: ignore
    except ImportError:
        return {"best_fit": "unavailable", "reason": "scipy/numpy not installed"}

    data = np.array(latencies_ms, dtype=float)
    data = data[data > 0]  # distributions require positive values
    if len(data) < 5:
        return {"best_fit": "insufficient_data"}

    candidates = [
        ("lognormal", scipy_stats.lognorm),
        ("weibull", scipy_stats.weibull_min),
        ("gamma", scipy_stats.gamma),
    ]

    best_name = ""
    best_aic = float("inf")
    results: dict[str, Any] = {}

    for name, dist in candidates:
        try:
            params = dist.fit(data, floc=0)
            log_likelihood = float(np.sum(dist.logpdf(data, *params)))
            k = len(params)
            aic = 2 * k - 2 * log_likelihood
            results[name] = {"params": [round(float(p), 4) for p in params], "aic": round(aic, 2)}
            if aic < best_aic:
                best_aic = aic
                best_name = name
        except Exception:  # noqa: BLE001
            results[name] = {"params": [], "aic": None}

    results["best_fit"] = best_name
    if best_name and results.get(best_name):
        results["interpretation"] = _interpret_fit(best_name, results[best_name]["params"])

    return results


def _interpret_fit(name: str, params: list[float]) -> str:
    if name == "lognormal" and len(params) >= 3:
        mu = round(math.log(params[2]) if params[2] > 0 else 0, 3) if params[2] else 0
        sigma = round(params[0], 3)
        return f"Latency follows a log-normal distribution with μ={mu}s, σ={sigma}s."
    if name == "weibull" and len(params) >= 3:
        return f"Latency follows a Weibull distribution with shape={round(params[0], 3)}, scale={round(params[2], 3)}ms."
    if name == "gamma" and len(params) >= 3:
        return f"Latency follows a gamma distribution with shape={round(params[0], 3)}, scale={round(params[2], 3)}ms."
    return ""


# ---------------------------------------------------------------------------
# FR-6.3  Latency anomaly detection
# ---------------------------------------------------------------------------


def flag_anomalies(
    records: list[dict[str, Any]],
    fit_result: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Flag rows where latency exceeds the p99 threshold."""
    latencies = [r.get("latency_ms", 0.0) for r in records]
    if not latencies:
        return []

    s = sorted(latencies)
    p99_idx = max(0, int(len(s) * 0.99) - 1)
    threshold = s[p99_idx]

    return [
        {
            "row_id": r["row_id"],
            "latency_ms": r.get("latency_ms"),
            "input_tokens": r.get("input_tokens"),
            "output_tokens": r.get("output_tokens"),
        }
        for r in records
        if r.get("latency_ms", 0.0) > threshold
    ]


# ---------------------------------------------------------------------------
# FR-6.4  Latency vs. input length regression
# ---------------------------------------------------------------------------


def latency_regression(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Linear regression: latency_ms ~ input_tokens."""
    xs = [float(r.get("input_tokens", 0)) for r in records]
    ys = [float(r.get("latency_ms", 0.0)) for r in records]
    n = len(xs)
    if n < 3:
        return {}

    mx, my = sum(xs) / n, sum(ys) / n
    ss_xy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    ss_xx = sum((x - mx) ** 2 for x in xs)

    if ss_xx == 0:
        return {"slope_ms_per_token": 0.0, "r_squared": 0.0}

    slope = ss_xy / ss_xx
    intercept = my - slope * mx
    y_pred = [slope * x + intercept for x in xs]
    ss_res = sum((y - yp) ** 2 for y, yp in zip(ys, y_pred))
    ss_tot = sum((y - my) ** 2 for y in ys)
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0

    return {
        "slope_ms_per_token": round(slope, 4),
        "intercept_ms": round(intercept, 4),
        "r_squared": round(r2, 4),
    }
