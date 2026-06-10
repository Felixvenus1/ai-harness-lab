// Purpose: Typed API client for traces, feedback, and guardrail endpoints.

import type {
  Feedback,
  FeedbackCategory,
  FeedbackSignal,
  FeedbackStats,
  GuardrailResult,
  PolicyConfig,
  PolicyStats,
  RegressionDatasetMeta,
  Trace,
  TraceSummary,
} from "../types/observability";

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

async function _fetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (body.detail) detail = String(body.detail);
    } catch { /* non-JSON */ }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

// ── Traces ────────────────────────────────────────────────────────────────

export async function listTraces(limit = 100): Promise<TraceSummary[]> {
  return _fetch<TraceSummary[]>(`${BASE}/traces?limit=${limit}`);
}

export async function getTrace(traceId: string): Promise<Trace> {
  return _fetch<Trace>(`${BASE}/traces/${traceId}`);
}

// ── Feedback ──────────────────────────────────────────────────────────────

export interface SubmitFeedbackRequest {
  trace_id: string;
  run_id?: string;
  signal: FeedbackSignal;
  categories?: FeedbackCategory[];
  note?: string;
  harness_version?: string;
  model_version?: string;
}

export async function submitFeedback(body: SubmitFeedbackRequest): Promise<Feedback> {
  return _fetch<Feedback>(`${BASE}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listFeedback(params?: {
  signal?: FeedbackSignal;
  harness_version?: string;
  limit?: number;
}): Promise<Feedback[]> {
  const qs = new URLSearchParams();
  if (params?.signal) qs.set("signal", params.signal);
  if (params?.harness_version) qs.set("harness_version", params.harness_version);
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  return _fetch<Feedback[]>(`${BASE}/feedback${q ? `?${q}` : ""}`);
}

export async function getFeedbackStats(harnessVersion?: string): Promise<FeedbackStats> {
  const q = harnessVersion ? `?harness_version=${harnessVersion}` : "";
  return _fetch<FeedbackStats>(`${BASE}/feedback/stats${q}`);
}

export async function createRegressionDataset(body: {
  feedback_ids: string[];
  name: string;
}): Promise<{ dataset_id: string; name: string; row_count: number }> {
  return _fetch(`${BASE}/feedback/regression-datasets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listRegressionDatasets(): Promise<RegressionDatasetMeta[]> {
  return _fetch<RegressionDatasetMeta[]>(`${BASE}/feedback/regression-datasets`);
}

export function regressionDatasetExportUrl(datasetId: string, format: "json" | "csv"): string {
  return `${BASE}/feedback/regression-datasets/${datasetId}/export?format=${format}`;
}

// ── Guardrails ────────────────────────────────────────────────────────────

export async function listPolicies(): Promise<PolicyConfig[]> {
  return _fetch<PolicyConfig[]>(`${BASE}/guardrails/policies`);
}

export async function createPolicy(config: Omit<PolicyConfig, "policy_id"> & { policy_id?: string }): Promise<PolicyConfig> {
  return _fetch<PolicyConfig>(`${BASE}/guardrails/policies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

export async function updatePolicy(policyId: string, config: PolicyConfig): Promise<PolicyConfig> {
  return _fetch<PolicyConfig>(`${BASE}/guardrails/policies/${policyId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

export async function deletePolicy(policyId: string): Promise<void> {
  await _fetch<void>(`${BASE}/guardrails/policies/${policyId}`, { method: "DELETE" });
}

export async function checkText(text: string, policyIds?: string[]): Promise<GuardrailResult> {
  return _fetch<GuardrailResult>(`${BASE}/guardrails/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, policy_ids: policyIds ?? [] }),
  });
}

export async function getPolicyStats(): Promise<PolicyStats> {
  return _fetch<PolicyStats>(`${BASE}/guardrails/stats`);
}
