"""Purpose: Provide stubs for JSON Schema validation helper behavior."""
from pydantic import BaseModel


class JsonSchemaValidation(BaseModel):
    valid: bool


def validate_json_schema() -> JsonSchemaValidation:
    return JsonSchemaValidation(valid=True)
