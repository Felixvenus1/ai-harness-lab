"""Purpose: Resolve provider names to provider instances available to the engine."""
from harness_core.provider import ProviderBase

from app.providers.mock_provider import MockProvider

# Registered provider factories keyed by public name.
_PROVIDERS: dict[str, type[ProviderBase]] = {
    "mock": MockProvider,
}


def list_providers() -> list[str]:
    """Return the names of all registered providers."""
    return sorted(_PROVIDERS.keys())


def get_provider(name: str) -> ProviderBase:
    """Instantiate a provider by name, raising KeyError if it is unknown."""
    try:
        factory = _PROVIDERS[name]
    except KeyError as exc:
        raise KeyError(f"unknown provider: {name}") from exc
    return factory()
