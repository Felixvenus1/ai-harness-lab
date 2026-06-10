"""Purpose: Bayesian posterior accuracy estimation and A/B comparison using Beta-Binomial model."""
from __future__ import annotations

import math
from typing import Any

from evaluation.stats.uncertainty import beta_hpdr


# ---------------------------------------------------------------------------
# FR-4.1  Posterior accuracy estimation
# ---------------------------------------------------------------------------


def posterior_accuracy(
    successes: int,
    trials: int,
    prior_alpha: float = 1.0,
    prior_beta: float = 1.0,
) -> dict[str, Any]:
    """Compute Beta posterior for accuracy given observed pass/fail counts.

    Default prior: Beta(1, 1) — uniform / uninformative.
    """
    failures = trials - successes
    post_alpha = prior_alpha + successes
    post_beta = prior_beta + failures

    mean = post_alpha / (post_alpha + post_beta)
    hpdr_90 = beta_hpdr(post_alpha, post_beta, 0.90)
    hpdr_95 = beta_hpdr(post_alpha, post_beta, 0.95)

    return {
        "posterior_mean": round(mean, 4),
        "hpdr_90": hpdr_90,
        "hpdr_95": hpdr_95,
        "post_alpha": post_alpha,
        "post_beta": post_beta,
        "successes": successes,
        "trials": trials,
    }


def prob_exceeds_threshold(
    post_alpha: float,
    post_beta: float,
    threshold: float,
) -> float:
    """Compute P(accuracy > threshold) from Beta(post_alpha, post_beta)."""
    from evaluation.stats.uncertainty import _beta_cdf

    return round(1.0 - _beta_cdf(threshold, post_alpha, post_beta), 4)


# ---------------------------------------------------------------------------
# FR-4.2  Bayesian A/B comparison
# ---------------------------------------------------------------------------


def compare_runs(
    successes_a: int,
    trials_a: int,
    successes_b: int,
    trials_b: int,
    rope_delta: float = 0.02,
    n_samples: int = 20_000,
    prior_alpha: float = 1.0,
    prior_beta: float = 1.0,
) -> dict[str, Any]:
    """Bayesian comparison of two binomial proportions via Monte Carlo sampling.

    Returns:
    - prob_a_superior: P(A > B)
    - expected_uplift: E[(A - B) / B] with 90% CI
    - rope_probability: P(|A - B| <= rope_delta)
    """
    post_a = posterior_accuracy(successes_a, trials_a, prior_alpha, prior_beta)
    post_b = posterior_accuracy(successes_b, trials_b, prior_alpha, prior_beta)

    try:
        import numpy as np  # type: ignore
        from scipy import stats as scipy_stats  # type: ignore

        rng = np.random.default_rng(42)
        samples_a = rng.beta(post_a["post_alpha"], post_a["post_beta"], n_samples)
        samples_b = rng.beta(post_b["post_alpha"], post_b["post_beta"], n_samples)

        prob_superior = float(np.mean(samples_a > samples_b))

        uplift = (samples_a - samples_b) / np.maximum(samples_b, 1e-9)
        expected_uplift = float(np.mean(uplift))
        uplift_lo, uplift_hi = float(np.percentile(uplift, 5)), float(np.percentile(uplift, 95))

        rope = float(np.mean(np.abs(samples_a - samples_b) <= rope_delta))

    except ImportError:
        # Pure-Python fallback using posterior means
        mean_a = post_a["posterior_mean"]
        mean_b = post_b["posterior_mean"]
        # Deterministic approximation (not Monte Carlo)
        prob_superior = 1.0 if mean_a > mean_b else 0.0
        expected_uplift = (mean_a - mean_b) / max(mean_b, 1e-9)
        uplift_lo, uplift_hi = expected_uplift * 0.9, expected_uplift * 1.1
        rope = 1.0 if abs(mean_a - mean_b) <= rope_delta else 0.0

    return {
        "posterior_a": post_a,
        "posterior_b": post_b,
        "prob_a_superior": round(prob_superior, 4),
        "expected_uplift": round(expected_uplift, 4),
        "uplift_hpdr_90": (round(uplift_lo, 4), round(uplift_hi, 4)),
        "rope_probability": round(rope, 4),
    }


# ---------------------------------------------------------------------------
# FR-4.3  Subgroup Bayesian analysis (partial pooling)
# ---------------------------------------------------------------------------


def subgroup_analysis(
    groups: dict[str, tuple[int, int]],
    prior_alpha: float = 1.0,
    prior_beta: float = 1.0,
) -> list[dict[str, Any]]:
    """Compute per-subgroup posteriors with partial pooling (shrinkage toward grand mean).

    `groups` maps group_name -> (successes, trials).

    Partial pooling: each subgroup posterior uses a prior anchored to the
    pooled estimate rather than a flat Beta(1,1), so small groups are
    shrunk toward the overall mean.
    """
    if not groups:
        return []

    total_s = sum(s for s, _ in groups.values())
    total_t = sum(t for _, t in groups.values())
    pooled_mean = (prior_alpha + total_s) / (prior_alpha + prior_beta + total_t)

    # Concentration: more data -> less shrinkage (empirical Bayes)
    concentration = max(5.0, total_t / max(len(groups), 1))
    pool_alpha = pooled_mean * concentration
    pool_beta = (1 - pooled_mean) * concentration

    results = []
    overall = posterior_accuracy(total_s, total_t, prior_alpha, prior_beta)

    for name, (s, t) in groups.items():
        grp = posterior_accuracy(s, t, pool_alpha, pool_beta)
        # Check overlap with overall HPDR
        overlap = _intervals_overlap(grp["hpdr_90"], overall["hpdr_90"])
        results.append({
            "group": name,
            "successes": s,
            "trials": t,
            "posterior_mean": grp["posterior_mean"],
            "hpdr_90": grp["hpdr_90"],
            "notable": not overlap,
        })

    results.sort(key=lambda x: x["posterior_mean"], reverse=True)
    return results


def _intervals_overlap(a: tuple[float, float], b: tuple[float, float]) -> bool:
    return a[0] <= b[1] and b[0] <= a[1]


# ---------------------------------------------------------------------------
# FR-4.4  Bayesian change detection (simplified CUSUM-based)
# ---------------------------------------------------------------------------


def detect_change_point(
    run_accuracies: list[tuple[str, float]],
) -> dict[str, Any]:
    """Detect a change point in a time series of (timestamp_str, accuracy) pairs.

    Uses a simple CUSUM approach to identify the most probable change point.
    Returns: estimated change point index, magnitude, and credible interval.
    """
    if len(run_accuracies) < 4:
        return {"change_detected": False, "reason": "insufficient_data"}

    values = [v for _, v in run_accuracies]
    timestamps = [t for t, _ in run_accuracies]
    n = len(values)
    grand_mean = sum(values) / n

    # CUSUM: cumulative sum of deviations from grand mean
    cusum = []
    cs = 0.0
    for v in values:
        cs += v - grand_mean
        cusum.append(cs)

    # Change point = index with maximum absolute CUSUM value
    cp_idx = max(range(n), key=lambda i: abs(cusum[i]))
    pre_mean = sum(values[:cp_idx]) / max(cp_idx, 1)
    post_mean = sum(values[cp_idx:]) / max(n - cp_idx, 1)
    magnitude = post_mean - pre_mean

    # Simple confidence: larger magnitude relative to variance = more confident
    variance = sum((v - grand_mean) ** 2 for v in values) / n
    stdev = math.sqrt(variance) if variance > 0 else 1e-9
    confidence = min(1.0, abs(magnitude) / (2 * stdev))

    return {
        "change_detected": abs(magnitude) > stdev,
        "change_point_index": cp_idx,
        "change_point_timestamp": timestamps[cp_idx] if cp_idx < len(timestamps) else None,
        "magnitude": round(magnitude, 4),
        "magnitude_ci_90": (round(magnitude - stdev, 4), round(magnitude + stdev, 4)),
        "confidence": round(confidence, 4),
        "pre_mean": round(pre_mean, 4),
        "post_mean": round(post_mean, 4),
    }
