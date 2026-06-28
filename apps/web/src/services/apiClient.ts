// Purpose: Typed HTTP client for all AI Harness Lab API endpoints.

import type { FlowGraph } from "../types/flow";
import type { ExecutionTrace } from "../types/api";
import type { RunResponse, PolicyConfig } from "../types/observability";

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

// ── Execution ────────────────────────────────────────────────────────────────

export interface RunRequest {
  graph: FlowGraph;
  policy_overrides?: PolicyConfig[];
  metadata?: Record<string, unknown>;
}

export async function postRun(req: RunRequest | FlowGraph): Promise<RunResponse> {
  const body: RunRequest = "nodes" in req ? { graph: req as FlowGraph } : (req as RunRequest);
  const res = await fetch(`${BASE}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { detail?: unknown };
      if (j.detail) detail = String(j.detail);
    } catch { /* non-JSON body */ }
    throw new Error(detail);
  }
  return res.json() as Promise<RunResponse>;
}

export async function postRunTrace(graph: FlowGraph): Promise<ExecutionTrace> {
  return (await postRun({ graph })).trace;
}

// ── Validation ───────────────────────────────────────────────────────────────

export interface ValidationIssue {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
  node_id?: string;
  edge_id?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export async function validateFlow(graph: FlowGraph): Promise<ValidationResult> {
  const res = await fetch(`${BASE}/flows/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(graph),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<ValidationResult>;
}

// ── Flow CRUD ────────────────────────────────────────────────────────────────

export interface SavedFlowMeta {
  id: string;
  name: string;
  node_count: number;
  edge_count: number;
  saved_at: string;
}

export interface SavedFlow extends SavedFlowMeta {
  graph: FlowGraph;
}

export async function saveFlow(graph: FlowGraph, name?: string): Promise<SavedFlowMeta> {
  const res = await fetch(`${BASE}/flows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ graph, name }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<SavedFlowMeta>;
}

export async function listFlows(): Promise<SavedFlowMeta[]> {
  const res = await fetch(`${BASE}/flows`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<SavedFlowMeta[]>;
}

export async function loadFlow(id: string): Promise<SavedFlow> {
  const res = await fetch(`${BASE}/flows/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<SavedFlow>;
}

export async function deleteFlow(id: string): Promise<void> {
  const res = await fetch(`${BASE}/flows/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
}
