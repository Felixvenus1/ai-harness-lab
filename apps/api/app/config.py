"""Purpose: Runtime configuration sourced from environment variables."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AI Harness Lab API"

    # Provider API keys — set in environment or .env file
    openrouter_api_key: str = ""
    anthropic_api_key: str = ""

    # OpenRouter defaults
    openrouter_default_model: str = "anthropic/claude-haiku-4-5"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # Anthropic defaults
    anthropic_default_model: str = "claude-haiku-4-5-20251001"
    anthropic_api_version: str = "2023-06-01"


@lru_cache
def get_settings() -> Settings:
    return Settings()
