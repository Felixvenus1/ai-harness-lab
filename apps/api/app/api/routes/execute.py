"""Purpose: POST /run — execute a FlowGraph with guardrails, async parallel branches, and tracing."""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from harness_core.schemas import ExecutionTrace, FlowGraph

from app.core.executor import FlowExecutionError, FlowExecutor
from app.guardrails.engine import GuardrailEngine
from app.guardrails.models import GuardrailResult, PolicyConfig
from app.guardrails.storage import list_policies, log_violation
from app.observability.collector import TraceCollector
from app.observability.models import SpanKind, SpanStatus

logger = logging.getLogger(__name__)

router = APIRouter(tags=["execute"])


class RunRequest(BaseModel):
    graph: FlowGraph
    policy_overrides: list[PolicyConfig] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class RunResponse(BaseModel):
    trace: ExecutionTrace
    trace_id: str
    guardrail_result: GuardrailResult | None = None


@router.post("/run", response_model=RunResponse)
async def run_flow(req: RunRequest) -> RunResponse:
    """Execute a flow graph asynchronously, apply guardrails, record a trace."""
    try:
        logger.info(f"Starting /run with graph: {req.graph.id}")
        graph = req.graph
        policies = req.policy_overrides if req.policy_overrides else list_policies()
        enabled_policies = [p for p in policies if p.enabled]
        logger.info(f"Loaded {len(enabled_policies)} enabled policies")

        collector = TraceCollector(
            flow_id=graph.id,
            flow_name=graph.name,
            harness_version="1.0",
        )
        collector.trace.metadata.update(req.metadata)
        logger.info(f"Created trace collector: {collector.trace_id}")

        engine = GuardrailEngine(enabled_policies) if enabled_policies else None
        logger.debug("Guardrail engine initialized")
    except Exception as exc:
        logger.error(f"Error initializing /run: {exc}", exc_info=True)
        raise

    # ── Pre-execution input guardrail ────────────────────────────────────────
    input_guardrail: GuardrailResult | None = None
    if engine is not None:
        grd_start = datetime.now(timezone.utc)
        t0 = time.perf_counter()
        input_guardrail = engine.run(str(graph.initial_input))
        grd_latency = (time.perf_counter() - t0) * 1000.0

        collector.add_span(
            kind=SpanKind.GUARDRAIL,
            name="input_guardrail",
            started_at=grd_start,
            ended_at=datetime.now(timezone.utc),
            input=graph.initial_input,
            output=input_guardrail.final_action.value,
            status=SpanStatus.BLOCKED if input_guardrail.blocked else SpanStatus.SUCCESS,
            metadata={"decisions": [d.model_dump() for d in input_guardrail.decisions]},
        )

        if input_guardrail.blocked:
            collector.finalize(
                final_output=None,
                passed=False,
                total_latency_ms=grd_latency,
                guardrail_blocked=True,
                guardrail_summary=[d.model_dump() for d in input_guardrail.decisions if d.triggered],
            )
            log_violation(collector.trace_id, input_guardrail.decisions)
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "GUARDRAIL_BLOCKED",
                    "explanation": input_guardrail.explanation,
                    "trace_id": collector.trace_id,
                    "decisions": [d.model_dump() for d in input_guardrail.decisions if d.triggered],
                },
            )

    # ── Execute flow (async, parallel branches) ──────────────────────────────
    try:
        logger.debug(f"Starting flow execution with {len(graph.nodes)} nodes")
        exec_trace = await FlowExecutor(graph, collector=collector).run()
        logger.info(f"Flow execution completed: passed={exec_trace.passed}, duration={exec_trace.total_duration_ms}ms")
    except FlowExecutionError as exc:
        logger.error(f"Flow execution error: {exc}", exc_info=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.error(f"Unexpected error during flow execution: {exc}", exc_info=True)
        raise

    # ── Post-execution output guardrail ──────────────────────────────────────
    output_guardrail: GuardrailResult | None = None
    if engine is not None:
        grd_start = datetime.now(timezone.utc)
        t0 = time.perf_counter()
        output_guardrail = engine.run(str(exec_trace.final_output))
        grd_latency_out = (time.perf_counter() - t0) * 1000.0

        collector.add_span(
            kind=SpanKind.GUARDRAIL,
            name="output_guardrail",
            started_at=grd_start,
            ended_at=datetime.now(timezone.utc),
            input=exec_trace.final_output,
            output=output_guardrail.final_action.value,
            status=SpanStatus.BLOCKED if output_guardrail.blocked else SpanStatus.SUCCESS,
            metadata={"decisions": [d.model_dump() for d in output_guardrail.decisions]},
        )

        if output_guardrail.blocked:
            collector.finalize(
                final_output=exec_trace.final_output,
                passed=False,
                total_latency_ms=exec_trace.total_duration_ms + grd_latency_out,
                guardrail_blocked=True,
                guardrail_summary=[d.model_dump() for d in output_guardrail.decisions if d.triggered],
            )
            log_violation(collector.trace_id, output_guardrail.decisions)
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "GUARDRAIL_BLOCKED",
                    "explanation": output_guardrail.explanation,
                    "trace_id": collector.trace_id,
                    "decisions": [d.model_dump() for d in output_guardrail.decisions if d.triggered],
                },
            )

    # ── Finalize and persist trace ────────────────────────────────────────────
    try:
        guardrail_summary: list[dict] = []
        if input_guardrail:
            guardrail_summary += [d.model_dump() for d in input_guardrail.decisions if d.triggered]
        if output_guardrail:
            log_violation(collector.trace_id, [d for d in output_guardrail.decisions if d.triggered])
            guardrail_summary += [d.model_dump() for d in output_guardrail.decisions if d.triggered]

        logger.debug("Finalizing trace")
        collector.finalize(
            final_output=exec_trace.final_output,
            passed=exec_trace.passed,
            total_latency_ms=exec_trace.total_duration_ms,
            guardrail_blocked=False,
            guardrail_summary=guardrail_summary,
        )
        logger.info(f"Trace finalized successfully: {collector.trace_id}")

        response = RunResponse(
            trace=exec_trace,
            trace_id=collector.trace_id,
            guardrail_result=output_guardrail or input_guardrail,
        )
        logger.debug(f"RunResponse created successfully")
        return response
    except Exception as exc:
        logger.error(f"Error finalizing response: {exc}", exc_info=True)
        raise
