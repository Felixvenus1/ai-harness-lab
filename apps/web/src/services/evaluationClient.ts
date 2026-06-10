// Purpose: Typed API client for the evaluation module endpoints.

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";
const EVAL = `${BASE}/evaluation`;

async function _fetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${EVAL}${path}`, init);
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

// ── Datasets ──────────────────────────────────────────────────────────────

export interface DatasetMeta {
  id: string;
  name: string;
  row_count: number;
  input_field: string;
  reference_field: string;
  label_field: string | null;
  group_field: string | null;
  preview?: Record<string, unknown>[];
  field_types?: Record<string, string>;
  null_counts?: Record<string, number>;
  warnings?: string[];
}

export async function uploadDataset(file: File): Promise<DatasetMeta> {
  const form = new FormData();
  form.append("file", file);
  return _fetch<DatasetMeta>("/datasets/upload", { method: "POST", body: form });
}

export async function listDatasets(): Promise<{ datasets: DatasetMeta[] }> {
  return _fetch("/datasets");
}

export async function getDataset(id: string): Promise<{ id: string; name: string; rows: Record<string, unknown>[]; schema: Record<string, unknown> }> {
  return _fetch(`/datasets/${id}`);
}

// ── Flows ─────────────────────────────────────────────────────────────────

export async function listFlows(): Promise<{ flows: { id: string; name: string }[] }> {
  return _fetch("/flows");
}

// ── Runs ──────────────────────────────────────────────────────────────────

export interface RunSummary {
  id: string;
  harness_id: string;
  dataset_id: string;
  timestamp: string;
  row_count: number;
  metrics_config: string[];
  top_metrics?: Record<string, number | null>;
}

export interface RunDetail {
  run_id: string;
  harness_id: string;
  dataset_id: string;
  timestamp: string;
  row_count: number;
  metrics_config: string[];
  summary: Record<string, unknown>;
}

export interface RunRecord {
  row_id: string;
  input: string;
  reference: string;
  output: string;
  group?: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  scores: Record<string, number>;
  judge_score?: number;
  judge_explanation?: string;
  error?: string;
}

export interface StartRunRequest {
  harness_id: string;
  dataset_id: string;
  metrics: string[];
  concurrency?: number;
  judge_config?: Record<string, unknown>;
}

export async function startRun(req: StartRunRequest): Promise<{ run_id: string; summary: Record<string, unknown>; row_count: number }> {
  return _fetch("/runs/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

export async function listRuns(): Promise<{ runs: RunSummary[] }> {
  return _fetch("/runs");
}

export async function getRun(id: string): Promise<RunDetail> {
  return _fetch(`/runs/${id}`);
}

export async function getRunRecords(id: string, page = 1, pageSize = 50): Promise<{ records: RunRecord[]; total: number; page: number }> {
  return _fetch(`/runs/${id}/records?page=${page}&page_size=${pageSize}`);
}

// ── Compare ───────────────────────────────────────────────────────────────

export interface CompareRequest {
  run_a_id: string;
  run_b_id: string;
  metrics?: string[];
  rope_delta?: number;
}

export async function compareRuns(req: CompareRequest): Promise<Record<string, unknown>> {
  return _fetch("/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

// ── Judge ─────────────────────────────────────────────────────────────────

export interface JudgeScoreRequest {
  input: string;
  output: string;
  reference?: string;
  rubric: string;
  scale: "binary" | "1-5" | "0-10";
  provider?: string;
  model?: string;
}

export async function judgeScore(req: JudgeScoreRequest): Promise<{ score: number; explanation: string; raw_response: string }> {
  return _fetch("/judge/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

// ── Perturbations ─────────────────────────────────────────────────────────

export async function perturbInput(input: string, strategies: string[], nVariants = 5): Promise<{ original: string; variants: { strategy: string; text: string }[] }> {
  return _fetch("/perturb", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, strategies, n_variants: nVariants }),
  });
}

// ── Metric definitions ────────────────────────────────────────────────────

export async function getMetricDefinitions(): Promise<{ metrics: { name: string; description: string; task_types: string[] }[] }> {
  return _fetch("/metrics/definitions");
}
