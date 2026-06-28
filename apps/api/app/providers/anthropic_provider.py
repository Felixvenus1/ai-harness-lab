"""Purpose: Anthropic provider — direct Messages API, supports all Claude models."""
from __future__ import annotations

import httpx

from harness_core.provider import ProviderBase


class AnthropicProvider(ProviderBase):
    name = "anthropic"

    def __init__(self, api_key: str = "", model: str = "") -> None:
        self._api_key = api_key
        self._model = model or "claude-haiku-4-5-20251001"

    def complete(self, messages: list) -> str:
        if not self._api_key:
            return "<anthropic: ANTHROPIC_API_KEY not set>"

        # Separate system prompt from user/assistant turns
        system: str | None = None
        turns: list[dict] = []
        for msg in messages:
            if msg.get("role") == "system":
                system = msg["content"]
            else:
                turns.append({"role": msg["role"], "content": msg["content"]})

        if not turns:
            turns = [{"role": "user", "content": ""}]

        payload: dict = {"model": self._model, "max_tokens": 1024, "messages": turns}
        if system:
            payload["system"] = system

        headers = {
            "x-api-key": self._api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        try:
            response = httpx.post(
                "https://api.anthropic.com/v1/messages",
                json=payload,
                headers=headers,
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            # content is a list of blocks; extract the first text block
            for block in data.get("content", []):
                if block.get("type") == "text":
                    return block["text"]
            return ""
        except httpx.HTTPStatusError as exc:
            return f"<anthropic error {exc.response.status_code}: {exc.response.text[:200]}>"
        except Exception as exc:  # noqa: BLE001
            return f"<anthropic error: {exc}>"
