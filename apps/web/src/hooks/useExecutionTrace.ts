// Purpose: Manage execution run lifecycle, triggering API calls and storing trace results.

import { useState, useCallback } from "react";
import type { ExecutionTrace } from "../types/api";
import type { FlowGraph } from "../types/flow";
import { postRun } from "../services/apiClient";

export type RunStatus = "idle" | "running" | "success" | "error";

export function useExecutionTrace() {
  const [trace, setTrace] = useState<ExecutionTrace | null>(null);
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
      const result = await postRun(graph);
      setTrace(result);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, []);

  const clear = useCallback(() => {
    setTrace(null);
    setStatus("idle");
    setError(null);
  }, []);

  return { trace, status, error, run, clear };
}
