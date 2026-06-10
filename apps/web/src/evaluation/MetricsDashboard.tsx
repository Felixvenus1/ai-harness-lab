// Purpose: Full metrics dashboard — accuracy, cost, latency, robustness panels.

import type { JSX } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, CartesianGrid, LineChart, Line,
} from "recharts";
import { Info } from "lucide-react";
import { BayesianPanel } from "./BayesianPanel";
import type { RunDetail } from "../services/evaluationClient";

interface MetricsDashboardProps {
  run: RunDetail;
}

export function MetricsDashboard({ run }: MetricsDashboardProps): JSX.Element {
  const s = run.summary as any;

  return (
    <div className="space-y-6 p-4 overflow-y-auto">
      {/* Small-sample warning */}
      {s.small_sample_warning && (
        <div className="flex items-start gap-2 text-amber-400 text-xs bg-amber-950/30 border border-amber-800 rounded p-3">
          <Info size={12} className="mt-0.5 shrink-0" />
          {s.small_sample_warning}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Accuracy"
          primary={s.accuracy ? `${(s.accuracy.bayesian?.posterior_mean * 100).toFixed(1)}%` : "—"}
          sub={s.accuracy ? `90% CI: [${(s.accuracy.bayesian?.hpdr_90?.[0] * 100).toFixed(1)}%, ${(s.accuracy.bayesian?.hpdr_90?.[1] * 100).toFixed(1)}%]` : ""}
          color="teal"
        />
        <KpiCard
          title="Cost"
          primary={s.cost ? `$${s.cost.mean_cost_per_request_usd?.toFixed(5)}` : "—"}
          sub={s.cost ? `Total: $${s.cost.total_cost_usd?.toFixed(5)}` : ""}
          color="violet"
        />
        <KpiCard
          title="Latency"
          primary={s.latency ? `${s.latency.p50}ms p50` : "—"}
          sub={s.latency ? `p95: ${s.latency.p95}ms` : ""}
          color="amber"
        />
        <KpiCard
          title="Rows"
          primary={String(run.row_count)}
          sub={`Metrics: ${run.metrics_config.join(", ")}`}
          color="blue"
        />
      </div>

      {/* FR-9.2 Accuracy panel */}
      {s.accuracy && (
        <Section title="Accuracy" info="Statistical accuracy metrics across all evaluation rows.">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <MetricRow label="Exact Match" value={pct(s.accuracy.exact_match_rate)} />
              <MetricRow label="Mean BERTScore F1" value={fmt3(s.accuracy.mean_bertscore_f1)} />
              <MetricRow label="Mean Semantic Sim." value={fmt3(s.accuracy.mean_semantic_similarity)} />
            </div>
            <BayesianPanel posterior={s.accuracy.bayesian} />
          </div>

          {/* Subgroup table */}
          {s.subgroups && s.subgroups.length > 0 && (
            <SubgroupTable groups={s.subgroups} />
          )}
        </Section>
      )}

      {/* FR-9.3 Cost panel */}
      {s.cost && (
        <Section title="Cost" info="Token usage and cost efficiency across the benchmark run.">
          <div className="grid grid-cols-3 gap-3 text-sm mb-4">
            <MiniStat label="Total Cost" value={`$${s.cost.total_cost_usd?.toFixed(5)}`} />
            <MiniStat label="Mean / Request" value={`$${s.cost.mean_cost_per_request_usd?.toFixed(5)}`} />
            <MiniStat label="Cost / Correct" value={s.cost.cost_per_correct_usd != null ? `$${s.cost.cost_per_correct_usd?.toFixed(5)}` : "—"} />
          </div>
          {s.tokens && <TokenBreakdown tokens={s.tokens} />}
        </Section>
      )}

      {/* FR-9.4 Latency panel */}
      {s.latency && (
        <Section title="Latency" info="Response time distribution and outlier analysis.">
          <LatencyPanel latency={s.latency} distribution={s.latency_distribution} regression={s.latency_regression} anomalies={s.latency_anomalies} />
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({ title, primary, sub, color }: { title: string; primary: string; sub: string; color: string }): JSX.Element {
  const colors: Record<string, string> = {
    teal: "border-teal-700 bg-teal-950/30",
    violet: "border-violet-700 bg-violet-950/30",
    amber: "border-amber-700 bg-amber-950/30",
    blue: "border-blue-700 bg-blue-950/30",
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color] ?? ""}`}>
      <p className="text-zinc-400 text-xs mb-1">{title}</p>
      <p className="text-zinc-100 text-xl font-bold tabular-nums">{primary}</p>
      <p className="text-zinc-500 text-xs mt-1 truncate">{sub}</p>
    </div>
  );
}

function Section({ title, info, children }: { title: string; info: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-zinc-200 font-medium text-sm">{title}</h3>
        <div className="group relative">
          <Info size={12} className="text-zinc-600 cursor-help" />
          <div className="absolute left-6 top-0 z-10 hidden group-hover:block bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded p-2 w-56 shadow-lg">{info}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200 font-mono">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="bg-zinc-800 rounded p-3">
      <p className="text-zinc-500 text-xs">{label}</p>
      <p className="text-zinc-100 font-mono text-sm font-semibold">{value}</p>
    </div>
  );
}

function TokenBreakdown({ tokens }: { tokens: any }): JSX.Element {
  const rows = [
    { label: "Input p50", value: tokens.input_tokens?.p50 },
    { label: "Input p90", value: tokens.input_tokens?.p90 },
    { label: "Input p99", value: tokens.input_tokens?.p99 },
    { label: "Output p50", value: tokens.output_tokens?.p50 },
    { label: "Output p90", value: tokens.output_tokens?.p90 },
    { label: "Output p99", value: tokens.output_tokens?.p99 },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {rows.map((r) => (
        <MiniStat key={r.label} label={r.label} value={r.value != null ? String(r.value) : "—"} />
      ))}
    </div>
  );
}

function LatencyPanel({ latency, distribution, regression, anomalies }: any): JSX.Element {
  const stats = [
    { l: "Mean", v: latency.mean }, { l: "p50", v: latency.p50 },
    { l: "p75", v: latency.p75 }, { l: "p90", v: latency.p90 },
    { l: "p95", v: latency.p95 }, { l: "p99", v: latency.p99 },
    { l: "CV", v: latency.cv?.toFixed(3) },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <MiniStat key={s.l} label={s.l} value={s.v != null ? (typeof s.v === "number" ? `${s.v}ms` : String(s.v)) : "—"} />
        ))}
      </div>

      {distribution?.best_fit && distribution.best_fit !== "unavailable" && (
        <p className="text-zinc-400 text-xs">
          Best fit: <span className="text-zinc-200">{distribution.best_fit}</span>
          {distribution.interpretation && ` — ${distribution.interpretation}`}
        </p>
      )}

      {regression && (
        <p className="text-zinc-400 text-xs">
          Latency vs token length: slope={regression.slope_ms_per_token}ms/token, R²={regression.r_squared}
        </p>
      )}

      {anomalies && anomalies.length > 0 && (
        <div>
          <p className="text-amber-400 text-xs mb-1">{anomalies.length} anomaly row(s) above p99 threshold</p>
          <table className="text-xs w-full">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="text-left py-1">Row ID</th>
                <th className="text-right py-1">Latency</th>
                <th className="text-right py-1">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.slice(0, 5).map((a: any) => (
                <tr key={a.row_id} className="border-b border-zinc-800/50">
                  <td className="py-1 font-mono text-zinc-400 truncate max-w-24">{a.row_id.slice(0, 8)}…</td>
                  <td className="py-1 text-right text-amber-400">{a.latency_ms}ms</td>
                  <td className="py-1 text-right text-zinc-400">{a.input_tokens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SubgroupTable({ groups }: { groups: any[] }): JSX.Element {
  return (
    <div>
      <p className="text-zinc-500 text-xs mb-1">Subgroup analysis</p>
      <table className="text-xs w-full">
        <thead>
          <tr className="text-zinc-500 border-b border-zinc-800">
            <th className="text-left py-1">Group</th>
            <th className="text-right py-1">Trials</th>
            <th className="text-right py-1">Post. Mean</th>
            <th className="text-right py-1">90% HPDR</th>
            <th className="text-right py-1">Notable</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g: any) => (
            <tr key={g.group} className="border-b border-zinc-800/50">
              <td className="py-1 text-zinc-200">{g.group}</td>
              <td className="py-1 text-right text-zinc-400">{g.trials}</td>
              <td className="py-1 text-right font-mono">{pct(g.posterior_mean)}</td>
              <td className="py-1 text-right font-mono">[{pct(g.hpdr_90?.[0])}, {pct(g.hpdr_90?.[1])}]</td>
              <td className="py-1 text-right">{g.notable ? <span className="text-amber-400">⚠</span> : <span className="text-zinc-600">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function pct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}
function fmt3(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(3);
}
