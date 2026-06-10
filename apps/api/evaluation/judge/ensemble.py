"""Purpose: Multi-judge ensemble voting, agreement scoring, and bias detection."""
from __future__ import annotations

import statistics
from typing import Any

from evaluation.judge.llm_judge import LLMJudge


# ---------------------------------------------------------------------------
# FR-8.4  Jury mode
# ---------------------------------------------------------------------------


def jury_score(
    input_text: str,
    output_text: str,
    rubric: str,
    scale: str,
    judge_configs: list[dict[str, str]],
    reference: str | None = None,
) -> dict[str, Any]:
    """Run multiple judges and aggregate scores.

    `judge_configs`: list of {"provider": ..., "model": ...} dicts.
    """
    individual: list[dict[str, Any]] = []
    scores: list[float] = []

    for cfg in judge_configs:
        judge = LLMJudge(
            provider_name=cfg.get("provider", "mock"),
            model=cfg.get("model", "mock"),
            scale=scale,
        )
        result = judge.score_pointwise(input_text, output_text, rubric, scale, reference)
        result["judge_id"] = f"{cfg.get('provider', 'mock')}/{cfg.get('model', 'mock')}"
        individual.append(result)
        scores.append(result["score"])

    if not scores:
        return {"aggregate_score": 0.0, "individual": [], "agreement": {}}

    if scale == "binary":
        # Majority vote
        n_pass = sum(1 for s in scores if s >= 0.5)
        aggregate = 1.0 if n_pass > len(scores) / 2 else 0.0
    else:
        aggregate = statistics.mean(scores)

    stdev = statistics.stdev(scores) if len(scores) > 1 else 0.0
    agreement = _inter_judge_agreement(scores, scale)

    high_disagreement = scale != "binary" and stdev > (1.5 / (10.0 if scale == "0-10" else 5.0))

    return {
        "aggregate_score": round(aggregate, 4),
        "individual": individual,
        "stdev": round(stdev, 4),
        "agreement": agreement,
        "high_disagreement_flag": high_disagreement,
    }


def _inter_judge_agreement(scores: list[float], scale: str) -> dict[str, Any]:
    """Compute Cohen's Kappa (binary) or Krippendorff's Alpha approximation (ordinal)."""
    if len(scores) < 2:
        return {}

    if scale == "binary":
        # Simplified Fleiss Kappa for 2-judge binary case
        n_pass = sum(1 for s in scores if s >= 0.5)
        p_agree = n_pass / len(scores)
        p_e = p_agree ** 2 + (1 - p_agree) ** 2
        kappa = (p_agree - p_e) / (1 - p_e) if p_e < 1 else 1.0
        return {"metric": "cohens_kappa", "value": round(kappa, 4)}

    # Ordinal: simplified Krippendorff's Alpha
    mean_s = statistics.mean(scores)
    variance = statistics.variance(scores) if len(scores) > 1 else 0.0
    # Normalised: 1 - observed_variance / expected_variance
    # Expected variance for uniformly distributed scores
    max_val = 10.0 if scale == "0-10" else 5.0
    expected_var = (max_val ** 2) / 12.0
    alpha = 1.0 - variance / expected_var if expected_var > 0 else 1.0
    return {"metric": "krippendorffs_alpha", "value": round(max(-1.0, min(1.0, alpha)), 4)}


# ---------------------------------------------------------------------------
# FR-8.5  Judge reliability (consistency)
# ---------------------------------------------------------------------------


def judge_consistency(
    judge_config: dict[str, str],
    test_input: str,
    test_output: str,
    rubric: str,
    scale: str,
    n_runs: int = 3,
) -> dict[str, Any]:
    """Score the same input/output n_runs times to measure judge variance."""
    judge = LLMJudge(
        provider_name=judge_config.get("provider", "mock"),
        model=judge_config.get("model", "mock"),
        scale=scale,
    )
    scores = []
    for _ in range(n_runs):
        r = judge.score_pointwise(test_input, test_output, rubric, scale)
        scores.append(r["score"])

    stdev = statistics.stdev(scores) if len(scores) > 1 else 0.0
    consistency = max(0.0, 1.0 - stdev * 10)  # normalised to [0,1]
    return {
        "judge_id": f"{judge_config.get('provider', 'mock')}/{judge_config.get('model', 'mock')}",
        "scores": scores,
        "stdev": round(stdev, 4),
        "consistency_score": round(consistency, 4),
    }


# ---------------------------------------------------------------------------
# FR-8.3  Bradley-Terry model for pairwise win probability
# ---------------------------------------------------------------------------


def bradley_terry(wins_a: int, wins_b: int, ties: int = 0) -> dict[str, float]:
    """Compute Bradley-Terry win probability for A given observed pairwise outcomes."""
    total = wins_a + wins_b + ties
    if total == 0:
        return {"prob_a_wins": 0.5, "wins_a": 0, "wins_b": 0, "ties": 0}

    # Effective wins counting ties as 0.5
    eff_a = wins_a + 0.5 * ties
    eff_b = wins_b + 0.5 * ties

    # Maximum likelihood estimate for Bradley-Terry strength ratio
    strength_a = eff_a / max(total, 1)
    prob_a = strength_a / (strength_a + (1 - strength_a)) if (strength_a + (1 - strength_a)) > 0 else 0.5

    return {
        "prob_a_wins": round(prob_a, 4),
        "wins_a": wins_a,
        "wins_b": wins_b,
        "ties": ties,
    }
