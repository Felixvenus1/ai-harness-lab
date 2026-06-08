"""Purpose: Provide stubs for converting flow payloads into executable graph structures."""
from pydantic import BaseModel


class ExecutionGraph(BaseModel):
    node_count: int = 0


def build_graph() -> ExecutionGraph:
    return ExecutionGraph()
