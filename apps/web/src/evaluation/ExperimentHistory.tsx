// Purpose: Experiment history — list saved runs, show trend, allow replay/compare.

import type { JSX } from "react";
import { useEffect, useState } from "react";
import { History, RefreshCw, Download } from "lucide-react";
import { listRuns, type RunSummary } from "../services/evaluationClient";

interface ExperimentHistoryProps {
  onSelectRun: (runId: string) => void;
  selectedRunIds: [string, string];
  onSelectForCompare: (runId: string, slot: 0 | 1) => void;
}

export function ExperimentHistory({ onSelectRun, selectedRunIds, onSelectForCompare }: ExperimentHistoryProps): JSX.Element {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "accuracy" | "cost">("date");
  const [filterHarness, setFilterHarness] = useState("");

  async function fetchRuns() {
    setLoading(true);
    try {
      const r = await listRuns();
      setRuns(r.runs);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRuns(); }, []);

  const uniqueHarnesses = [...new Set(runs.map((r) => r.harness_id))];

  const filtered = runs
    .filter((r) => !filterHarness || r.harness_id === filterHarness)
    .sort((a, b) => {
      if (sortBy === "date") return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (sortBy === "accuracy") {
        const accA = a.top_metrics?.posterior_mean_accuracy ?? 0;
        const accB = b.top_metrics?.posterior_mean_accuracy ?? 0;
        return (accB as number) - (accA as number);
      }
      const cA = a.top_metrics?.total_cost_usd ?? 0;
      const cB = b.top_metrics?.total_cost_usd ?? 0;
      return (cA as number) - (cB as number);
    });

  function handleDownloadCsv(runId: string) {
    const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";
    window.open(`${base}/evaluation/runs/${runId}/export/csv`, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-zinc-200 font-semibold text-sm flex items-center gap-2">
          <History size={14} /> Experiment History
        </h2>
        <button onClick={fetchRuns} disabled={loading} className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 text-xs outline-none focus:border-teal-500">
          <option value="date">Sort: Date</option>
          <option value="accuracy">Sort: Accuracy</option>
          <option value="cost">Sort: Cost ↑</option>
        </select>
        <select value={filterHarness} onChange={(e) => setFilterHarness(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 text-xs outline-none focus:border-teal-500">
          <option value="">All harnesses</option>
          {uniqueHarnesses.map((h) => <option key={h} value={h}>{h.slice(0, 12)}…</option>)}
        </select>
      </div>

      {filtered.length === 0 && !loading && (
        <p className="text-zinc-600 text-sm text-center py-8">No saved runs yet. Start a benchmark to see results here.</p>
      )}

      <div className="space-y-2">
        {filtered.map((run) => (
          <RunRow
            key={run.id}
            run={run}
            isSelectedA={selectedRunIds[0] === run.id}
            isSelectedB={selectedRunIds[1] === run.id}
            onView={() => onSelectRun(run.id)}
            onSelectA={() => onSelectForCompare(run.id, 0)}
            onSelectB={() => onSelectForCompare(run.id, 1)}
            onDownload={() => handleDownloadCsv(run.id)}
          />
        ))}
      </div>
    </div>
  );
}

function RunRow({ run, isSelectedA, isSelectedB, onView, onSelectA, onSelectB, onDownload }: {
  run: RunSummary;
  isSelectedA: boolean;
  isSelectedB: boolean;
  onView: () => void;
  onSelectA: () => void;
  onSelectB: () => void;
  onDownload: () => void;
}): JSX.Element {
  const acc = run.top_metrics?.posterior_mean_accuracy;
  const cost = run.top_metrics?.total_cost_usd;
  const p50 = run.top_metrics?.latency_p50_ms;

  return (
    <div className={`bg-zinc-900 border rounded-lg p-3 transition-colors ${isSelectedA ? "border-teal-600" : isSelectedB ? "border-violet-600" : "border-zinc-800"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 flex-1 min-w-0">
          <p className="text-zinc-200 text-xs font-mono truncate">{run.id.slice(0, 8)}… — {new Date(run.timestamp).toLocaleString()}</p>
          <p className="text-zinc-500 text-xs truncate">Flow: {run.harness_id.slice(0, 20)}… · {run.row_count} rows</p>
          <div className="flex gap-3 mt-1">
            {acc != null && <Chip label="Acc" value={`${(acc * 100).toFixed(1)}%`} color="teal" />}
            {cost != null && <Chip label="Cost" value={`$${(cost as number).toFixed(5)}`} color="violet" />}
            {p50 != null && <Chip label="p50" value={`${p50}ms`} color="amber" />}
          </div>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={onView} className="text-xs text-teal-400 hover:text-teal-300 transition-colors">View</button>
          <button onClick={onSelectA} className={`text-xs transition-colors ${isSelectedA ? "text-teal-400" : "text-zinc-500 hover:text-zinc-300"}`}>A</button>
          <button onClick={onSelectB} className={`text-xs transition-colors ${isSelectedB ? "text-violet-400" : "text-zinc-500 hover:text-zinc-300"}`}>B</button>
          <button onClick={onDownload} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <Download size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: string; color: string }): JSX.Element {
  const colors: Record<string, string> = {
    teal: "text-teal-400",
    violet: "text-violet-400",
    amber: "text-amber-400",
  };
  return (
    <span className="text-xs">
      <span className="text-zinc-600">{label}: </span>
      <span className={`font-mono ${colors[color] ?? "text-zinc-300"}`}>{value}</span>
    </span>
  );
}
