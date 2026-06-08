"""Purpose: Provide stubs for execution planning and node order resolution."""
from pydantic import BaseModel


class ExecutionPlan(BaseModel):
    steps: list[str] = []


def create_plan() -> ExecutionPlan:
    return ExecutionPlan()
