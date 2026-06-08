// Purpose: Render a per-node execution trace with pass/fail badges and collapsible JSON.

import { useState, type JSX } from "react";
import { ChevronDown, ChevronRight, X, CheckCircle2, XCircle } from "lucide-react";
import { NODE_META } from "../config/nodeConfig";
import type { ExecutionTrace, ExecutionResult } from "../types/api";
import type { NodeType } from "../types/flow";

interface TracePanelProps {
  trace: ExecutionTrace;
  error: string | null;
  onClose: () => void;
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="text-[10px] font-mono text-zinc-400 bg-zinc-950 rounded p-2 overflow-x-auto max-h-28 leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function TraceRow({ result }: { result: ExecutionResult }): JSX.Element {
  const [open, setOpen] = useState(false);
  const meta = NODE_META[result.node_type as NodeType];
  const Icon = meta?.Icon;

  return (
    <div className="border-b border-zinc-800 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/40 transition-colors text-left"
      >
        {open ? (
          <ChevronDown size={11} className="text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight size={11} className="text-zinc-500 shrink-0" />
        )}
        {Icon && <Icon size={11} className={meta.iconColorClass} />}
        <span className="text-xs text-zinc-300 font-mono flex-1 truncate">{result.node_id}</span>
        <span className="text-[10px] text-zinc-500">
          {result.node_type.replace(/_/g, " ")}
        </span>
        <span
          className={[
            "text-[10px] px-1.5 py-0.5 rounded border font-medium",
            result.passed
              ? "bg-emerald-950 text-emerald-400 border-emerald-800"
              : "bg-red-950 text-red-400 border-red-800",
          ].join(" ")}
        >
          {result.passed ? "pass" : "fail"}
        </span>
        <span className="text-[10px] text-zinc-600 tabular-nums w-16 text-right shrink-0">
          {result.duration_ms.toFixed(1)} ms
        </span>
      </button>

      {open && (
        <div className="px-3 pb-2 flex flex-col gap-1.5">
          {result.error && (
            <p className="text-[10px] text-red-400 bg-red-950/30 rounded px-2 py-1 border border-red-900">
              {result.error}
            </p>
          )}
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Input</p>
            <JsonBlock value={result.input} />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Output</p>
            <JsonBlock value={result.output} />
          </div>
        </div>
      )}
    </div>
  );
}

export function ExecutionTracePanel({
  trace,
  error,
  onClose,
}: TracePanelProps): JSX.Element {
  return (
    <div className="h-72 bg-zinc-900 border-t border-zinc-800 flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800 shrink-0">
        {trace.passed ? (
          <CheckCircle2 size={13} className="text-emerald-400" />
        ) : (
          <XCircle size={13} className="text-red-400" />
        )}
        <span className="text-xs font-semibold text-zinc-200">
          Execution Trace
        </span>
        <span
          className={[
            "text-[10px] px-1.5 py-0.5 rounded border font-medium",
            trace.passed
              ? "bg-emerald-950 text-emerald-400 border-emerald-800"
              : "bg-red-950 text-red-400 border-red-800",
          ].join(" ")}
        >
          {trace.passed ? "Passed" : "Failed"}
        </span>
        <span className="text-[10px] text-zinc-500">
          {trace.total_duration_ms.toFixed(1)} ms
        </span>
        <div className="flex-1" />
        {error && <span className="text-xs text-red-400 truncate max-w-xs">{error}</span>}
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-200 transition-colors p-0.5 rounded"
        >
          <X size={13} />
        </button>
      </div>

      {/* Rows */}
      <div className="overflow-y-auto flex-1">
        {trace.results.map((r) => (
          <TraceRow key={r.node_id} result={r} />
        ))}
        {trace.results.length === 0 && (
          <p className="text-zinc-600 text-xs px-3 py-4 italic">No nodes were executed.</p>
        )}
      </div>
    </div>
  );
}
