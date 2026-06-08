"""Purpose: Define custom API and execution error stubs for normalized failure handling."""
from pydantic import BaseModel


class ErrorPayload(BaseModel):
    code: str
    message: str
