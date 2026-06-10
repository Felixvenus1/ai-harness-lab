"""Purpose: Abstract base class for all judge implementations."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class JudgeBase(ABC):
    """Abstract interface for LLM-as-a-judge implementations."""

    @abstractmethod
    def score_pointwise(
        self,
        input_text: str,
        output_text: str,
        rubric: str,
        scale: str,
        reference: str | None = None,
    ) -> dict[str, Any]:
        """Score a single output against a rubric.

        Returns: {"score": float, "explanation": str, "raw_response": str}
        """

    @abstractmethod
    def compare_pairwise(
        self,
        input_text: str,
        output_a: str,
        output_b: str,
        rubric: str,
    ) -> dict[str, Any]:
        """Compare two outputs and return a preference.

        Returns: {"winner": "A" | "B" | "tie", "explanation": str, "raw_response": str}
        """
