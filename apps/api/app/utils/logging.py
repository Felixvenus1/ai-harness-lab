"""Purpose: Provide stubs for configuring structured logging behavior in the API."""
from pydantic import BaseModel


class LoggingConfig(BaseModel):
    level: str = "INFO"
