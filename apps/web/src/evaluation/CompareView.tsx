// Purpose: Side-by-side A/B comparison view for two benchmark runs.

import type { JSX } from "react";
import { useState, useEffect } from "react";
import { GitCompare, Loader2 } from "lucide-react";
import { compareRuns, listRuns, type RunSummary } from "../services/evaluationClient";
import { BayesianPanel } from "./BayesianPanel";

export function CompareView(): JSX.Element {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runA, setRunA] = useState("");
  const [runB, setRunB] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRuns().then((r) => setRuns(r.runs)).catch(() => {});
  }, []);

  async function handleCompare() {
    if (!runA || !runB) return;
    setLoading(true);
    setError(null);
    try {
      const r = await compareRuns({ run_a_id: runA, run_b_id: runB });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-zinc-200 font-semibold text-sm flex items-center gap-2">
        <GitCompare size={14} /> A/B Comparison
      </h2>

      <div className="flex gap-3 items-end">
        <div className="flex-1 space-y-1">
          <label className="text-zinc-400 text-xs">Run A</label>
          <select value={runA} onChange={(e) => setRunA(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 text-sm outline-none focus:border-teal-500">
            <option value="">— select run —</option>
            {runs.map((r) => <option key={r.id} value={r.id}>{r.id.slice(0, 8)}… · {r.row_count} rows · {new Date(r.timestamp).toLocaleDateString()}</option>)}
          </select>
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-zinc-400 text-xs">Run B</label>
          <select value={runB} onChange={(e) => setRunB(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 text-sm outline-none focus:border-teal-500">
            <option value="">— select run —</option>
            {runs.filter((r) => r.id !== runA).map((r) => <option key={r.id} value={r.id}>{r.id.slice(0, 8)}… · {r.row_count} rows · {new Date(r.timestamp).toLocaleDateString()}</option>)}
          </select>
        </div>
        <button
          onClick={handleCompare}
          disabled={!runA || !runB || loading}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <GitCompare size={14} />}
          Compare
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {result && (
        <div className="space-y-4">
          {/* Accuracy Bayesian comparison */}
          {result.bayesian_comparison?.accuracy && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <h3 className="text-zinc-200 text-sm font-medium mb-3">Accuracy Comparison</h3>
              <BayesianPanel
                comparisonA={result.bayesian_comparison.accuracy.posterior_a}
                comparisonB={result.bayesian_comparison.accuracy.posterior_b}
                comparisonLabel={{ a: "Run A", b: "Run B" }}
                probASuperior={result.bayesian_comparison.accuracy.prob_a_superior}
                expectedUplift={result.bayesian_comparison.accuracy.expected_uplift}
                upliftHpdr90={result.bayesian_comparison.accuracy.uplift_hpdr_90}
                ropeProbability={result.bayesian_comparison.accuracy.rope_probability}
                ropeLabel="P(|A-B| ≤ 2%)"
              />
            </div>
          )}

          {/* Continuous metrics side-by-side */}
          {["latency_ms", "cost_usd"].map((metric) => {
            const d = result.bayesian_comparison?.[metric];
            if (!d) return null;
            return (
              <div key={metric} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <h3 className="text-zinc-200 text-sm font-medium mb-3">{metric === "latency_ms" ? "Latency" : "Cost"}</h3>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <StatCard label="Run A mean" value={fmt(d.mean_a, metric)} />
                  <StatCard label="Run B mean" value={fmt(d.mean_b, metric)} />
                  <StatCard label="Δ (A − B)" value={fmt(d.delta, metric)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="bg-zinc-800 rounded p-3">
      <p className="text-zinc-500 text-xs">{label}</p>
      <p className="text-zinc-100 font-mono font-semibold">{value}</p>
    </div>
  );
}

function fmt(v: number | null, metric: string): string {
  if (v == null) return "—";
  if (metric === "latency_ms") return `${v.toFixed(1)}ms`;
  if (metric === "cost_usd") return `$${v.toFixed(6)}`;
  return v.toFixed(3);
}
