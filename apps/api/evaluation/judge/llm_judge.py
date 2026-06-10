"""Purpose: LLM-as-a-judge implementation using the existing provider registry."""
from __future__ import annotations

import sys
import os
from typing import Any

from evaluation.judge.base import JudgeBase
from evaluation.judge.rubric import (
    build_pointwise_prompt,
    build_pairwise_prompt,
    parse_pointwise_response,
    parse_pairwise_response,
)

# Add the API app to the path so we can import from app.providers
_API_ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "app")
if _API_ROOT not in sys.path:
    sys.path.insert(0, _API_ROOT)


class LLMJudge(JudgeBase):
    """Judge that delegates scoring to a provider via the existing harness provider registry."""

    def __init__(self, provider_name: str = "mock", model: str = "mock", scale: str = "1-5") -> None:
        self.provider_name = provider_name
        self.model = model
        self.scale = scale

    def _call_provider(self, prompt: str) -> str:
        try:
            from app.providers.registry import get_provider  # type: ignore

            provider = get_provider(self.provider_name)
            return provider.complete([{"role": "user", "content": prompt}])
        except Exception as exc:  # noqa: BLE001
            return f"ERROR: {exc}"

    def score_pointwise(
        self,
        input_text: str,
        output_text: str,
        rubric: str,
        scale: str,
        reference: str | None = None,
    ) -> dict[str, Any]:
        prompt = build_pointwise_prompt(input_text, output_text, rubric, scale, reference)
        raw = self._call_provider(prompt)
        score, explanation = parse_pointwise_response(raw, scale)
        return {"score": round(score, 4), "explanation": explanation, "raw_response": raw}

    def compare_pairwise(
        self,
        input_text: str,
        output_a: str,
        output_b: str,
        rubric: str,
    ) -> dict[str, Any]:
        prompt = build_pairwise_prompt(input_text, output_a, output_b, rubric)
        raw = self._call_provider(prompt)
        winner = parse_pairwise_response(raw)
        return {"winner": winner, "explanation": raw.strip(), "raw_response": raw}
