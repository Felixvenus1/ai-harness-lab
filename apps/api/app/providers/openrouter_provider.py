"""Purpose: OpenRouter provider — OpenAI-compatible REST API, routes to 200+ models."""
from __future__ import annotations

import httpx

from harness_core.provider import ProviderBase


class OpenRouterProvider(ProviderBase):
    name = "openrouter"

    def __init__(self, api_key: str = "", model: str = "") -> None:
        self._api_key = api_key
        self._model = model or "anthropic/claude-haiku-4-5"
        self._base_url = "https://openrouter.ai/api/v1"

    def complete(self, messages: list) -> str:
        if not self._api_key:
            return "<openrouter: OPENROUTER_API_KEY not set>"

        payload = {"model": self._model, "messages": messages}
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/aiharness-lab",
            "X-Title": "AI Harness Lab",
        }
        try:
            response = httpx.post(
                f"{self._base_url}/chat/completions",
                json=payload,
                headers=headers,
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as exc:
            return f"<openrouter error {exc.response.status_code}: {exc.response.text[:200]}>"
        except Exception as exc:  # noqa: BLE001
            return f"<openrouter error: {exc}>"
