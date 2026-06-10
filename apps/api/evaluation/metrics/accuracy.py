"""Purpose: Compute accuracy metrics — exact match, token F1, BLEU, ROUGE, BERTScore."""
from __future__ import annotations

import re
import string
from collections import Counter
from typing import Any


# ---------------------------------------------------------------------------
# Text normalisation
# ---------------------------------------------------------------------------


def _normalise(text: str) -> str:
    """Lowercase, strip whitespace, remove punctuation."""
    text = text.lower().strip()
    text = text.translate(str.maketrans("", "", string.punctuation))
    return re.sub(r"\s+", " ", text).strip()


def _tokenise(text: str) -> list[str]:
    return _normalise(text).split()


# ---------------------------------------------------------------------------
# FR-3.1  Exact match
# ---------------------------------------------------------------------------


def exact_match(output: str, reference: str) -> bool:
    return _normalise(output) == _normalise(reference)


def exact_match_rate(outputs: list[str], references: list[str]) -> float:
    if not outputs:
        return 0.0
    hits = sum(exact_match(o, r) for o, r in zip(outputs, references))
    return hits / len(outputs)


# ---------------------------------------------------------------------------
# FR-3.2  Token-level F1
# ---------------------------------------------------------------------------


def token_f1(output: str, reference: str) -> dict[str, float]:
    pred_tokens = Counter(_tokenise(output))
    ref_tokens = Counter(_tokenise(reference))
    common = pred_tokens & ref_tokens
    num_same = sum(common.values())
    if num_same == 0:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0}
    precision = num_same / sum(pred_tokens.values())
    recall = num_same / sum(ref_tokens.values())
    f1 = 2 * precision * recall / (precision + recall)
    return {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4)}


# ---------------------------------------------------------------------------
# FR-3.3  BLEU (smoothed)
# ---------------------------------------------------------------------------


def _ngrams(tokens: list[str], n: int) -> Counter:
    return Counter(tuple(tokens[i : i + n]) for i in range(len(tokens) - n + 1))


def bleu_score(output: str, reference: str, max_n: int = 4) -> dict[str, float]:
    """Compute BLEU-1 through BLEU-N with add-1 smoothing and brevity penalty."""
    import math

    pred = _tokenise(output)
    ref = _tokenise(reference)
    if not pred or not ref:
        return {f"bleu_{n}": 0.0 for n in range(1, max_n + 1)}

    scores: dict[str, float] = {}
    log_avg = 0.0
    for n in range(1, max_n + 1):
        pred_ng = _ngrams(pred, n)
        ref_ng = _ngrams(ref, n)
        clipped = sum(min(c, ref_ng[g]) for g, c in pred_ng.items())
        total = max(1, len(pred) - n + 1)
        # Add-1 smoothing
        precision = (clipped + 1) / (total + 1)
        scores[f"bleu_{n}"] = round(precision, 4)
        log_avg += math.log(precision)

    # Brevity penalty
    bp = 1.0 if len(pred) >= len(ref) else math.exp(1 - len(ref) / max(1, len(pred)))
    bleu = round(bp * math.exp(log_avg / max_n), 4)
    scores["bleu"] = bleu
    return scores


# ---------------------------------------------------------------------------
# FR-3.4  ROUGE
# ---------------------------------------------------------------------------


def rouge_scores(output: str, reference: str) -> dict[str, float]:
    """Compute ROUGE-1, ROUGE-2, ROUGE-L."""
    pred = _tokenise(output)
    ref = _tokenise(reference)

    def _rouge_n(n: int) -> float:
        pred_ng = _ngrams(pred, n)
        ref_ng = _ngrams(ref, n)
        overlap = sum(min(c, ref_ng[g]) for g, c in pred_ng.items())
        denom = sum(ref_ng.values())
        return overlap / denom if denom else 0.0

    def _lcs_len(a: list[str], b: list[str]) -> int:
        m, n = len(a), len(b)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                dp[i][j] = dp[i - 1][j - 1] + 1 if a[i - 1] == b[j - 1] else max(dp[i - 1][j], dp[i][j - 1])
        return dp[m][n]

    r1 = _rouge_n(1)
    r2 = _rouge_n(2)
    lcs = _lcs_len(pred, ref)
    rouge_l = lcs / len(ref) if ref else 0.0

    return {
        "rouge_1": round(r1, 4),
        "rouge_2": round(r2, 4),
        "rouge_l": round(rouge_l, 4),
    }


# ---------------------------------------------------------------------------
# FR-3.5  BERTScore (via sentence-transformers)
# ---------------------------------------------------------------------------


_embed_model: Any = None


def _get_embed_model() -> Any:
    global _embed_model  # noqa: PLW0603
    if _embed_model is None:
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore

            _embed_model = SentenceTransformer("all-MiniLM-L6-v2")
        except ImportError:
            return None
    return _embed_model


def bertscore(output: str, reference: str) -> dict[str, float]:
    """Compute BERTScore P/R/F1 using sentence-transformers embeddings."""
    import numpy as np

    model = _get_embed_model()
    if model is None:
        # Fall back to cosine of bag-of-words overlap
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0, "available": False}  # type: ignore[return-value]

    pred_tokens = _normalise(output).split()
    ref_tokens = _normalise(reference).split()

    if not pred_tokens or not ref_tokens:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0}

    # Embed all tokens in one batch
    all_tokens = pred_tokens + ref_tokens
    embeddings = model.encode(all_tokens, show_progress_bar=False, normalize_embeddings=True)
    pred_emb = embeddings[: len(pred_tokens)]
    ref_emb = embeddings[len(pred_tokens) :]

    # Token-level cosine similarity matrix
    sim_matrix = pred_emb @ ref_emb.T  # shape: (|pred|, |ref|)

    precision = float(np.mean(np.max(sim_matrix, axis=1)))
    recall = float(np.mean(np.max(sim_matrix, axis=0)))
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    return {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4)}


# ---------------------------------------------------------------------------
# FR-3.6  Semantic similarity
# ---------------------------------------------------------------------------


def semantic_similarity(output: str, reference: str) -> float:
    """Cosine similarity between sentence-level embeddings in [0, 1]."""
    import numpy as np

    model = _get_embed_model()
    if model is None:
        return 0.0

    embs = model.encode([output, reference], show_progress_bar=False, normalize_embeddings=True)
    sim = float(np.clip(embs[0] @ embs[1], 0.0, 1.0))
    return round(sim, 4)


# ---------------------------------------------------------------------------
# Batch helpers
# ---------------------------------------------------------------------------


def compute_all(output: str, reference: str, task_type: str = "generation") -> dict[str, float]:
    """Compute all accuracy metrics for a single output/reference pair."""
    results: dict[str, float] = {}
    results["exact_match"] = float(exact_match(output, reference))
    results.update({f"token_{k}": v for k, v in token_f1(output, reference).items()})
    results.update(bleu_score(output, reference))
    results.update(rouge_scores(output, reference))
    bert = bertscore(output, reference)
    results.update({f"bertscore_{k}": v for k, v in bert.items() if k != "available"})
    results["semantic_similarity"] = semantic_similarity(output, reference)
    return results
