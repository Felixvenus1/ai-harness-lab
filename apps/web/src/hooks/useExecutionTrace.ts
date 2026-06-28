// Purpose: Manage execution run lifecycle, triggering API calls and storing trace results.

import { useState, useCallback } from "react";
import type { ExecutionTrace } from "../types/api";
import type { GuardrailResult } from "../types/observability";
import type { FlowGraph } from "../types/flow";
import { postRun } from "../services/apiClient";

/** "success" = API responded AND trace.passed. "failed" = API ok but trace.passed=false. */
export type RunStatus = "idle" | "running" | "success" | "failed" | "error";

export function useExecutionTrace() {
  const [trace, setTrace] = useState<ExecutionTrace | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [guardrailResult, setGuardrailResult] = useState<GuardrailResult | null>(null);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (graph: FlowGraph) => {
    if (graph.nodes.length === 0) {
      setError("Add at least one node to the canvas before running.");
      setStatus("error");
      return;
    }
    setStatus("running");
    setError(null);
    try {
      const result = await postRun({ graph });
      setTrace(result.trace);
      setTraceId(result.trace_id);
      setGuardrailResult(result.guardrail_result);
      setStatus(result.trace.passed ? "success" : "failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, []);

  const clear = useCallback(() => {
    setTrace(null);
    setTraceId(null);
    setGuardrailResult(null);
    setStatus("idle");
    setError(null);
  }, []);

  return { trace, traceId, guardrailResult, status, error, run, clear };
}
