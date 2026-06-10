// Purpose: Trace list + detail — browse all traces and inspect span timelines.

import type { JSX } from "react";
import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { listTraces, getTrace } from "../services/observabilityClient";
import { TraceDetail } from "../components/TraceDetail";
import { FeedbackWidget } from "../components/FeedbackWidget";
import type { Trace, TraceSummary } from "../types/observability";

function StatusBadge({ passed, blocked }: { passed: boolean | null; blocked: boolean }) {
  if (blocked) return <span className="text-orange-400 text-[10px]">blocked</span>;
  if (passed === true) return <span className="text-teal-400 text-[10px]">passed</span>;
  if (passed === false) return <span className="text-red-400 text-[10px]">failed</span>;
  return <span className="text-zinc-500 text-[10px]">—</span>;
}

export function TracesTab(): JSX.Element {
  const [summaries, setSummaries] = useState<TraceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Trace | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listTraces(100);
      setSummaries(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await getTrace(id));
    } catch {
      /* detail error — will show nothing */
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar list */}
      <aside className="w-72 shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
          <span className="text-zinc-400 text-xs flex-1">Recent Traces</span>
          <button
            onClick={load}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        {error && <div className="text-red-400 text-xs px-3 py-2">{error}</div>}
        <ul className="flex-1 overflow-y-auto divide-y divide-zinc-800">
          {summaries.length === 0 && !loading && (
            <li className="text-zinc-600 text-xs px-3 py-4 text-center">
              No traces yet. Run a flow to capture one.
            </li>
          )}
          {summaries.map((s) => (
            <li key={s.trace_id}>
              <button
                onClick={() => loadDetail(s.trace_id)}
                className={`w-full text-left px-3 py-2 hover:bg-zinc-800/50 transition-colors ${
                  selectedId === s.trace_id ? "bg-zinc-800" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-zinc-200 text-xs truncate">
                    {s.flow_name ?? "Unnamed"}
                  </span>
                  <StatusBadge passed={s.passed} blocked={s.guardrail_blocked} />
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500">
                  <span>{s.span_count} spans</span>
                  {s.failed_span_count > 0 && (
                    <span className="text-red-500">{s.failed_span_count} failed</span>
                  )}
                  {s.total_latency_ms != null && (
                    <span className="ml-auto">{s.total_latency_ms.toFixed(0)} ms</span>
                  )}
                </div>
                <div className="text-[10px] text-zinc-600 mt-0.5">
                  {new Date(s.started_at).toLocaleString()}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Detail panel */}
      <main className="flex-1 overflow-y-auto">
        {!selectedId && (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            Select a trace to inspect.
          </div>
        )}
        {selectedId && detailLoading && (
          <div className="flex items-center justify-center h-full text-zinc-500 text-xs animate-pulse">
            Loading trace…
          </div>
        )}
        {detail && !detailLoading && (
          <div>
            <TraceDetail trace={detail} />
            <div className="px-4 pb-6">
              <div className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Feedback</div>
              <FeedbackWidget
                traceId={detail.trace_id}
                runId={detail.run_id ?? undefined}
                harnessVersion={detail.harness_version}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
