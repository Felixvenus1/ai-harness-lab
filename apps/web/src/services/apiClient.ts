// Purpose: Provide a typed HTTP client for communicating with the AI Harness Lab API.

import type { FlowGraph } from "../types/flow";
import type { ExecutionTrace } from "../types/api";

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

export async function postRun(graph: FlowGraph): Promise<ExecutionTrace> {
  const res = await fetch(`${BASE}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(graph),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (body.detail) detail = String(body.detail);
    } catch {
      /* non-JSON error body — keep the status text */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<ExecutionTrace>;
}
