"""Purpose: Resolve provider names to provider instances available to the engine."""
from __future__ import annotations

from harness_core.provider import ProviderBase

from app.config import get_settings
from app.providers.anthropic_provider import AnthropicProvider
from app.providers.mock_provider import MockProvider
from app.providers.openrouter_provider import OpenRouterProvider


def list_providers() -> list[str]:
    return ["mock", "openrouter", "anthropic"]


def get_provider(name: str, model: str | None = None) -> ProviderBase:
    """Instantiate a provider by name. API keys are sourced from settings/env vars."""
    cfg = get_settings()

    if name == "mock":
        return MockProvider()

    if name == "openrouter":
        return OpenRouterProvider(
            api_key=cfg.openrouter_api_key,
            model=model or cfg.openrouter_default_model,
        )

    if name == "anthropic":
        return AnthropicProvider(
            api_key=cfg.anthropic_api_key,
            model=model or cfg.anthropic_default_model,
        )

    # Fall back to mock for unknown providers so nothing hard-crashes.
    return MockProvider()
