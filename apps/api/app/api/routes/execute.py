"""Purpose: Expose POST /run to execute a FlowGraph and return its ExecutionTrace."""
from fastapi import APIRouter, HTTPException
from harness_core.schemas import ExecutionTrace, FlowGraph

from app.core.executor import FlowExecutionError, FlowExecutor

router = APIRouter(tags=["execute"])


@router.post("/run", response_model=ExecutionTrace)
def run_flow(graph: FlowGraph) -> ExecutionTrace:
    try:
        return FlowExecutor(graph).run()
    except FlowExecutionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
