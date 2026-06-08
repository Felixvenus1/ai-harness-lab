"""Purpose: Define Gemini provider stubs that satisfy the shared provider contract."""
from app.providers.base import BaseProvider, ProviderRequest, ProviderResponse


class GeminiProvider(BaseProvider):
    def complete(self, request: ProviderRequest) -> ProviderResponse:
        return ProviderResponse(content="")
