"""Purpose: Define Pydantic settings model stubs for runtime configuration."""
from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "AI Harness Lab API"
