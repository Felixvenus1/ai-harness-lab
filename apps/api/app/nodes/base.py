"""Purpose: Declare shared base class stubs for all executable harness nodes."""
from pydantic import BaseModel


class BaseNodeExecutor(BaseModel):
    node_type: str

    def run(self) -> dict:
        return {}
