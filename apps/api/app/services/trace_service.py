"""Purpose: Provide stubs for constructing execution trace objects for the web UI."""
from pydantic import BaseModel


class TraceRecord(BaseModel):
    node_id: str


def create_trace() -> list[TraceRecord]:
    return []
