"""Purpose: Provide stubs for schema and semantic validation of flow definitions."""
from pydantic import BaseModel


class ValidationResult(BaseModel):
    valid: bool


def validate_flow() -> ValidationResult:
    return ValidationResult(valid=True)
