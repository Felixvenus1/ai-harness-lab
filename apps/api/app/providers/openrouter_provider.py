"""Purpose: Define OpenRouter provider stubs that satisfy the shared provider contract."""
from app.providers.base import BaseProvider, ProviderRequest, ProviderResponse


class OpenRouterProvider(BaseProvider):
    def complete(self, request: ProviderRequest) -> ProviderResponse:
        return ProviderResponse(content="")
