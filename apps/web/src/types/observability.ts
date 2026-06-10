// Purpose: TypeScript types for the observability, feedback, and guardrail modules.

// ── Observability ─────────────────────────────────────────────────────────

export type SpanKind =
  | "model_call"
  | "tool_call"
  | "retrieval"
  | "validation"
  | "guardrail"
  | "fallback"
  | "retry"
  | "general";

export type SpanStatus = "success" | "failure" | "blocked" | "redacted" | "retried";

export interface Span {
  span_id: string;
  trace_id: string;
  parent_span_id: string | null;
  kind: SpanKind;
  name: string;
  started_at: string; // ISO datetime
  ended_at: string;
  latency_ms: number;
  input: unknown;
  output: unknown;
  status: SpanStatus;
  error: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  metadata: Record<string, unknown>;
}

export interface TrajectoryScore {
  total_steps: number;
  tool_call_count: number;
  retry_count: number;
  failed_span_rate: number;
  blocked_span_rate: number;
  median_step_latency_ms: number;
  p95_step_latency_ms: number;
  sample_note: string | null;
}

export interface Trace {
  trace_id: string;
  run_id: string | null;
  flow_id: string | null;
  flow_name: string | null;
  harness_version: string;
  started_at: string;
  ended_at: string | null;
  total_latency_ms: number | null;
  spans: Span[];
  final_output: unknown;
  passed: boolean | null;
  trajectory_score: TrajectoryScore | null;
  guardrail_blocked: boolean;
  guardrail_summary: Record<string, unknown>[];
  metadata: Record<string, unknown>;
}

export interface TraceSummary {
  trace_id: string;
  run_id: string | null;
  flow_name: string | null;
  harness_version: string;
  started_at: string;
  total_latency_ms: number | null;
  passed: boolean | null;
  guardrail_blocked: boolean;
  span_count: number;
  failed_span_count: number;
}

// ── Guardrails ────────────────────────────────────────────────────────────

export type PolicyType =
  | "pii"
  | "hate"
  | "dangerous_intent"
  | "prompt_injection"
  | "output_format"
  | "sensitive_redaction";

export type PolicyAction = "allow" | "warn" | "block" | "redact";

export interface PolicyConfig {
  policy_id: string;
  name: string;
  type: PolicyType;
  action: PolicyAction;
  enabled: boolean;
  params: Record<string, unknown>;
}

export interface PolicyDecision {
  policy_id: string;
  policy_name: string;
  policy_type: PolicyType;
  action_taken: PolicyAction;
  triggered: boolean;
  reason: string | null;
  redacted_text: string | null;
}

export interface GuardrailResult {
  decisions: PolicyDecision[];
  final_action: PolicyAction;
  blocked: boolean;
  output_text: string | null;
  explanation: string | null;
}

export interface PolicyStats {
  total_evaluations: number;
  block_rate_by_type: Record<string, number>;
  redact_rate: number;
  warn_rate: number;
  false_positive_queue_size: number;
  sample_note: string | null;
}

// ── Feedback ──────────────────────────────────────────────────────────────

export type FeedbackSignal = "thumbs_up" | "thumbs_down";
export type FeedbackCategory =
  | "incorrect"
  | "unsafe"
  | "incomplete"
  | "slow"
  | "bad_format"
  | "hallucination"
  | "other";

export interface Feedback {
  feedback_id: string;
  trace_id: string;
  run_id: string | null;
  signal: FeedbackSignal;
  categories: FeedbackCategory[];
  note: string | null;
  harness_version: string | null;
  model_version: string | null;
  created_at: string;
}

export interface FeedbackStats {
  total: number;
  thumbs_up: number;
  thumbs_down: number;
  thumbs_up_rate: number;
  thumbs_down_rate: number;
  category_counts: Record<string, number>;
  by_harness_version: Record<string, { thumbs_up: number; thumbs_down: number; total: number }>;
  sample_note: string | null;
}

export interface RegressionDatasetMeta {
  dataset_id: string;
  name: string;
  created_at: string;
  row_count: number;
}

// ── Run with guardrail result ─────────────────────────────────────────────

import type { ExecutionTrace } from "./api";

export interface RunResponse {
  trace: ExecutionTrace;
  trace_id: string;
  guardrail_result: GuardrailResult | null;
}
