"""Purpose: Define Pydantic API schema stubs for flow document payloads."""
from pydantic import BaseModel


class FlowSchemaModel(BaseModel):
    id: str
