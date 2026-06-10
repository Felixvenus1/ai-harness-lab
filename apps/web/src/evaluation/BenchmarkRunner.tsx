// Purpose: Benchmark runner UI — configure and start a run, show live progress.

import type { JSX } from "react";
import { useState, useEffect } from "react";
import { Play, Loader2 } from "lucide-react";
import {
  listFlows,
  listDatasets,
  startRun,
  type DatasetMeta,
  type RunDetail,
} from "../services/evaluationClient";

const ALL_METRICS = ["accuracy", "cost", "latency", "robustness", "judge"];

interface BenchmarkRunnerProps {
  onRunComplete: (run: RunDetail) => void;
}

export function BenchmarkRunner({ onRunComplete }: BenchmarkRunnerProps): JSX.Element {
  const [flows, setFlows] = useState<{ id: string; name: string }[]>([]);
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [selectedFlow, setSelectedFlow] = useState("");
  const [selectedDataset, setSelectedDataset] = useState("");
  const [metrics, setMetrics] = useState<string[]>(["accuracy", "cost", "latency"]);
  const [concurrency, setConcurrency] = useState(1);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number; accuracy?: number; latency?: number; cost?: number } | null>(null);

  useEffect(() => {
    listFlows().then((r) => setFlows(r.flows)).catch(() => {});
    listDatasets().then((r) => setDatasets(r.datasets)).catch(() => {});
  }, []);

  function toggleMetric(m: string) {
    setMetrics((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  }

  async function handleRun() {
    if (!selectedFlow || !selectedDataset) return;
    setStatus("running");
    setError(null);
    setProgress({ completed: 0, total: 0 });

    try {
      const result = await startRun({
        harness_id: selectedFlow,
        dataset_id: selectedDataset,
        metrics,
        concurrency,
      });
      // Build minimal RunDetail for display
      const run: RunDetail = {
        run_id: result.run_id,
        harness_id: selectedFlow,
        dataset_id: selectedDataset,
        timestamp: new Date().toISOString(),
        row_count: result.row_count,
        metrics_config: metrics,
        summary: result.summary,
      };
      setProgress({ completed: result.row_count, total: result.row_count });
      setStatus("done");
      onRunComplete(run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
      setStatus("error");
    }
  }

  const canRun = selectedFlow && selectedDataset && metrics.length > 0 && status !== "running";

  return (
    <div className="space-y-5">
      <h2 className="text-zinc-200 font-semibold text-sm">Benchmark Runner</h2>

      {/* Flow selector */}
      <div className="space-y-1">
        <label className="text-zinc-400 text-xs">Harness Flow</label>
        <select
          value={selectedFlow}
          onChange={(e) => setSelectedFlow(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 text-sm outline-none focus:border-teal-500"
        >
          <option value="">— select a flow —</option>
          {flows.map((f) => (
            <option key={f.id} value={f.id}>{f.name || f.id}</option>
          ))}
        </select>
      </div>

      {/* Dataset selector */}
      <div className="space-y-1">
        <label className="text-zinc-400 text-xs">Dataset</label>
        <select
          value={selectedDataset}
          onChange={(e) => setSelectedDataset(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 text-sm outline-none focus:border-teal-500"
        >
          <option value="">— select a dataset —</option>
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>{d.name} ({d.row_count} rows)</option>
          ))}
        </select>
      </div>

      {/* Metrics selector */}
      <div className="space-y-1">
        <label className="text-zinc-400 text-xs">Metrics to compute</label>
        <div className="flex flex-wrap gap-2">
          {ALL_METRICS.map((m) => (
            <button
              key={m}
              onClick={() => toggleMetric(m)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                metrics.includes(m)
                  ? "bg-teal-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Concurrency */}
      <div className="space-y-1">
        <label className="text-zinc-400 text-xs">Concurrency (1–5 workers)</label>
        <input
          type="range"
          min={1}
          max={5}
          value={concurrency}
          onChange={(e) => setConcurrency(Number(e.target.value))}
          className="w-full accent-teal-500"
        />
        <div className="text-zinc-400 text-xs">{concurrency} worker{concurrency > 1 ? "s" : ""}</div>
      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={!canRun}
        className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors"
      >
        {status === "running" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Play size={14} />
        )}
        {status === "running" ? "Running…" : "Start Benchmark"}
      </button>

      {/* Progress */}
      {status === "running" && progress && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>{progress.completed} / {progress.total || "?"} rows</span>
            {progress.accuracy != null && (
              <span>Accuracy: {(progress.accuracy * 100).toFixed(1)}%</span>
            )}
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5">
            <div
              className="bg-teal-500 h-1.5 rounded-full transition-all"
              style={{ width: progress.total ? `${(progress.completed / progress.total) * 100}%` : "0%" }}
            />
          </div>
        </div>
      )}

      {status === "done" && (
        <p className="text-emerald-400 text-sm">✓ Benchmark complete</p>
      )}

      {status === "error" && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
    </div>
  );
}
