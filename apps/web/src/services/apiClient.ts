// Purpose: Provide a typed HTTP client for communicating with the AI Harness Lab API.

import type { FlowGraph } from "../types/flow";
import type { ExecutionTrace } from "../types/api";
import type { RunResponse, PolicyConfig } from "../types/observability";

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

export interface RunRequest {
  graph: FlowGraph;
  policy_overrides?: PolicyConfig[];
  metadata?: Record<string, unknown>;
}

/** Execute a flow graph. Returns the full RunResponse including trace_id. */
export async function postRun(req: RunRequest | FlowGraph): Promise<RunResponse> {
  // Accept both old-style FlowGraph (backwards-compat) and new RunRequest.
  const body: RunRequest = "nodes" in req ? { graph: req as FlowGraph } : (req as RunRequest);

  const res = await fetch(`${BASE}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const bodyJson = (await res.json()) as { detail?: unknown };
      if (bodyJson.detail) detail = String(bodyJson.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<RunResponse>;
}

/** Legacy helper — returns just the execution trace for callers that don't need trace_id. */
export async function postRunTrace(graph: FlowGraph): Promise<ExecutionTrace> {
  const result = await postRun({ graph });
  return result.trace;
}
