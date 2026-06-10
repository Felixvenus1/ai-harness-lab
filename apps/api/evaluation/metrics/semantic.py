"""Purpose: Embedding-based semantic similarity scoring."""
from __future__ import annotations

from evaluation.metrics.accuracy import semantic_similarity, bertscore

__all__ = ["semantic_similarity", "bertscore"]
