"""Purpose: Define Pydantic API schema stubs for execution request and result models."""
from pydantic import BaseModel


class ExecutionRequest(BaseModel):
    flow: dict
    input: dict


class ExecutionResult(BaseModel):
    status: str
