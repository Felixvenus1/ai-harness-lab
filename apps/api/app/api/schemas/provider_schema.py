"""Purpose: Define Pydantic API schema stubs for provider capability metadata."""
from pydantic import BaseModel


class ProviderCapability(BaseModel):
    name: str
