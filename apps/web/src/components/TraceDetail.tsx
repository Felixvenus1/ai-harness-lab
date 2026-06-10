// Purpose: Render a single trace as a span timeline tree with trajectory stats.

import type { JSX } from "react";
import type { Span, SpanStatus, Trace, TrajectoryScore } from "../types/observability";

// ── helpers ──────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<SpanStatus, string> = {
  success: "text-teal-400",
  failure: "text-red-400",
  blocked: "text-orange-400",
  redacted: "text-yellow-400",
  retried: "text-blue-400",
};

const STATUS_DOT: Record<SpanStatus, string> = {
  success: "bg-teal-400",
  failure: "bg-red-400",
  blocked: "bg-orange-400",
  redacted: "bg-yellow-400",
  retried: "bg-blue-400",
};

const KIND_ICON: Record<string, string> = {
  model_call: "⬡",
  tool_call: "⚙",
  retrieval: "⊛",
  validation: "✓",
  guardrail: "⛨",
  fallback: "↩",
  retry: "↻",
  general: "◆",
};

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 200 ? v.slice(0, 200) + "…" : v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour12: false, fractionalSecondDigits: 3 });
}

// ── SpanRow ───────────────────────────────────────────────────────────────

function SpanRow({ span, depth }: { span: Span; depth: number }): JSX.Element {
  return (
    <details className="group" open={span.status !== "success"}>
      <summary
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-zinc-800/60 rounded select-none"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[span.status]}`} />
        <span className="text-zinc-500 text-xs w-4 shrink-0">{KIND_ICON[span.kind] ?? "◆"}</span>
        <span className="text-zinc-200 text-xs font-mono flex-1 truncate">{span.name}</span>
        <span className={`text-xs font-mono shrink-0 ${STATUS_COLOR[span.status]}`}>
          {span.status}
        </span>
        <span className="text-zinc-500 text-xs shrink-0">{span.latency_ms.toFixed(1)} ms</span>
      </summary>

      <div
        className="ml-4 mt-1 mb-2 pl-4 border-l border-zinc-700 text-xs space-y-1"
        style={{ marginLeft: `${20 + depth * 16}px` }}
      >
        <div className="flex gap-2 text-zinc-500">
          <span>{fmtTime(span.started_at)}</span>
          <span>→</span>
          <span>{fmtTime(span.ended_at)}</span>
        </div>
        {span.error && (
          <div className="text-red-400 bg-red-950/40 rounded px-2 py-1">{span.error}</div>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>
            <div className="text-zinc-500 uppercase tracking-wide text-[10px] mb-0.5">Input</div>
            <pre className="text-zinc-300 bg-zinc-800/60 rounded p-1.5 overflow-x-auto max-h-32 whitespace-pre-wrap break-words">
              {fmt(span.input)}
            </pre>
          </div>
          <div>
            <div className="text-zinc-500 uppercase tracking-wide text-[10px] mb-0.5">Output</div>
            <pre className="text-zinc-300 bg-zinc-800/60 rounded p-1.5 overflow-x-auto max-h-32 whitespace-pre-wrap break-words">
              {fmt(span.output)}
            </pre>
          </div>
        </div>
        {(span.input_tokens != null || span.cost_usd != null) && (
          <div className="flex gap-4 text-zinc-500">
            {span.input_tokens != null && <span>in: {span.input_tokens} tok</span>}
            {span.output_tokens != null && <span>out: {span.output_tokens} tok</span>}
            {span.cost_usd != null && <span>${span.cost_usd.toFixed(6)}</span>}
          </div>
        )}
      </div>
    </details>
  );
}

// ── TrajectoryStats ────────────────────────────────────────────────────────

function TrajectoryStats({ score }: { score: TrajectoryScore }): JSX.Element {
  const items: [string, string | number][] = [
    ["Steps", score.total_steps],
    ["Tool calls", score.tool_call_count],
    ["Retries", score.retry_count],
    ["Fail rate", `${(score.failed_span_rate * 100).toFixed(1)}%`],
    ["Block rate", `${(score.blocked_span_rate * 100).toFixed(1)}%`],
    ["Median latency", `${score.median_step_latency_ms.toFixed(1)} ms`],
    ["p95 latency", `${score.p95_step_latency_ms.toFixed(1)} ms`],
  ];
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {items.map(([label, val]) => (
        <div key={label} className="bg-zinc-800 rounded px-2 py-1">
          <span className="text-zinc-500">{label}: </span>
          <span className="text-zinc-200 font-mono">{val}</span>
        </div>
      ))}
      {score.sample_note && (
        <div className="text-yellow-500 bg-yellow-950/30 rounded px-2 py-1 w-full">
          ⚠ {score.sample_note}
        </div>
      )}
    </div>
  );
}

// ── TraceDetail ────────────────────────────────────────────────────────────

interface TraceDetailProps {
  trace: Trace;
}

export function TraceDetail({ trace }: TraceDetailProps): JSX.Element {
  // Build a simple depth map: spans without parents are at depth 0.
  const depthMap = new Map<string, number>();
  for (const span of trace.spans) {
    const parent = span.parent_span_id;
    depthMap.set(span.span_id, parent ? (depthMap.get(parent) ?? 0) + 1 : 0);
  }

  const passed = trace.passed;

  return (
    <div className="flex flex-col gap-4 p-4 text-sm">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-zinc-300 font-semibold">{trace.flow_name ?? "Unnamed Flow"}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${
            passed ? "border-teal-700 text-teal-400" : "border-red-700 text-red-400"
          }`}
        >
          {passed ? "passed" : "failed"}
        </span>
        {trace.guardrail_blocked && (
          <span className="text-xs px-2 py-0.5 rounded-full border border-orange-700 text-orange-400">
            guardrail blocked
          </span>
        )}
        <span className="text-zinc-500 text-xs font-mono">{trace.trace_id}</span>
        {trace.total_latency_ms != null && (
          <span className="text-zinc-500 text-xs">{trace.total_latency_ms.toFixed(1)} ms total</span>
        )}
      </div>

      {/* Trajectory score */}
      {trace.trajectory_score && (
        <div>
          <div className="text-zinc-500 text-xs uppercase tracking-wide mb-1">
            Trajectory Score
          </div>
          <TrajectoryStats score={trace.trajectory_score} />
        </div>
      )}

      {/* Span tree */}
      <div>
        <div className="text-zinc-500 text-xs uppercase tracking-wide mb-1">
          Spans ({trace.spans.length})
        </div>
        <div className="border border-zinc-700 rounded overflow-hidden">
          {trace.spans.length === 0 ? (
            <div className="text-zinc-500 text-xs px-3 py-2">No spans recorded.</div>
          ) : (
            trace.spans.map((span) => (
              <SpanRow key={span.span_id} span={span} depth={depthMap.get(span.span_id) ?? 0} />
            ))
          )}
        </div>
      </div>

      {/* Guardrail summary */}
      {trace.guardrail_summary.length > 0 && (
        <div>
          <div className="text-zinc-500 text-xs uppercase tracking-wide mb-1">
            Guardrail Decisions
          </div>
          <div className="space-y-1">
            {trace.guardrail_summary.map((d, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs bg-zinc-800/60 rounded px-2 py-1.5"
              >
                <span className="text-orange-400 shrink-0">{String(d.policy_type)}</span>
                <span className="text-zinc-300">{String(d.reason ?? "—")}</span>
                <span className="ml-auto text-zinc-500 shrink-0">
                  {String(d.action_taken)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
