// Purpose: Bayesian posterior distribution panel with credible intervals and A/B comparison.

import type { JSX } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Info } from "lucide-react";

interface PosteriorInfo {
  posterior_mean: number;
  hpdr_90: [number, number];
  hpdr_95: [number, number];
  successes: number;
  trials: number;
}

interface BayesianPanelProps {
  posterior?: PosteriorInfo;
  comparisonA?: PosteriorInfo;
  comparisonB?: PosteriorInfo;
  comparisonLabel?: { a: string; b: string };
  probASuperior?: number;
  expectedUplift?: number;
  upliftHpdr90?: [number, number];
  ropeProbability?: number;
  ropeLabel?: string;
}

// Generate Beta(α,β) PDF points for plotting
function betaPdfPoints(alpha: number, beta: number, n = 200): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  // B(a,b) via log-gamma approximation
  const logBeta = lgamma(alpha) + lgamma(beta) - lgamma(alpha + beta);
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    if (x === 0 || x === 1) {
      points.push({ x, y: 0 });
      continue;
    }
    const logPdf = (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logBeta;
    points.push({ x: Math.round(x * 1000) / 1000, y: Math.min(Math.exp(logPdf), 30) });
  }
  return points;
}

function lgamma(z: number): number {
  // Stirling approximation
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, tmp = x + 5.5;
  tmp = (x + 0.5) * Math.log(tmp) - tmp;
  let ser = 1.000000000190015;
  for (const ci of c) { y += 1; ser += ci / y; }
  return tmp + Math.log((2.5066282746310005 * ser) / x);
}

export function BayesianPanel({
  posterior,
  comparisonA,
  comparisonB,
  comparisonLabel,
  probASuperior,
  expectedUplift,
  upliftHpdr90,
  ropeProbability,
  ropeLabel,
}: BayesianPanelProps): JSX.Element {
  if (!posterior && !comparisonA) {
    return (
      <div className="text-zinc-500 text-sm p-4 text-center">
        No Bayesian data available. Run a benchmark first.
      </div>
    );
  }

  const hasComparison = !!(comparisonA && comparisonB);

  return (
    <div className="space-y-6">
      {/* Single posterior */}
      {posterior && !hasComparison && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-zinc-200 text-sm font-medium">Posterior Accuracy Distribution</h3>
            <Tooltip_ text="Beta posterior given observed pass/fail outcomes. Wider = more uncertainty (fewer samples)." />
          </div>
          <PosteriorChart alpha={posterior.post_alpha ?? 1 + posterior.successes} beta={posterior.post_beta ?? 1 + (posterior.trials - posterior.successes)} color="#14b8a6" />
          <CredibleIntervalRow posterior={posterior} />
        </div>
      )}

      {/* A/B comparison */}
      {hasComparison && comparisonA && comparisonB && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-zinc-200 text-sm font-medium">Posterior Comparison</h3>
            <Tooltip_ text="Overlay of two Beta posteriors. The overlap region indicates uncertainty about which run is better." />
          </div>
          <ComparisonChart posteriorA={comparisonA} posteriorB={comparisonB} labels={comparisonLabel} />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <StatCard label={`P(${comparisonLabel?.a ?? "A"} > ${comparisonLabel?.b ?? "B"})`} value={probASuperior != null ? `${(probASuperior * 100).toFixed(1)}%` : "—"} />
            <StatCard label="Expected Uplift" value={expectedUplift != null ? `${(expectedUplift * 100).toFixed(2)}%` : "—"} />
            <StatCard label="Uplift 90% CI" value={upliftHpdr90 ? `[${(upliftHpdr90[0] * 100).toFixed(2)}%, ${(upliftHpdr90[1] * 100).toFixed(2)}%]` : "—"} />
            <StatCard label={`P(practically equivalent)`} value={ropeProbability != null ? `${(ropeProbability * 100).toFixed(1)}%` : "—"} sub={ropeLabel} />
          </div>
        </div>
      )}
    </div>
  );
}

function PosteriorChart({ alpha, beta, color }: { alpha: number; beta: number; color: string }): JSX.Element {
  const data = betaPdfPoints(alpha, beta);
  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis dataKey="x" tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fill: "#71717a", fontSize: 10 }} />
        <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
        <Area type="monotone" dataKey="y" stroke={color} fill={color} fillOpacity={0.2} strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ComparisonChart({ posteriorA, posteriorB, labels }: { posteriorA: PosteriorInfo; posteriorB: PosteriorInfo; labels?: { a: string; b: string } }): JSX.Element {
  const aA = (posteriorA as any).post_alpha ?? 1 + posteriorA.successes;
  const bA = (posteriorA as any).post_beta ?? 1 + (posteriorA.trials - posteriorA.successes);
  const aB = (posteriorB as any).post_alpha ?? 1 + posteriorB.successes;
  const bB = (posteriorB as any).post_beta ?? 1 + (posteriorB.trials - posteriorB.successes);
  const logBetaFn = (a: number, b: number) => lgamma(a) + lgamma(b) - lgamma(a + b);
  const n = 200;
  const data = Array.from({ length: n + 1 }, (_, i) => {
    const x = i / n;
    if (x === 0 || x === 1) return { x, yA: 0, yB: 0 };
    const logA = (aA - 1) * Math.log(x) + (bA - 1) * Math.log(1 - x) - logBetaFn(aA, bA);
    const logB = (aB - 1) * Math.log(x) + (bB - 1) * Math.log(1 - x) - logBetaFn(aB, bB);
    return { x: Math.round(x * 1000) / 1000, yA: Math.min(Math.exp(logA), 30), yB: Math.min(Math.exp(logB), 30) };
  });
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis dataKey="x" tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fill: "#71717a", fontSize: 10 }} />
        <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
        <Area type="monotone" dataKey="yA" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.2} strokeWidth={1.5} dot={false} name={labels?.a ?? "Run A"} />
        <Area type="monotone" dataKey="yB" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.2} strokeWidth={1.5} dot={false} name={labels?.b ?? "Run B"} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function CredibleIntervalRow({ posterior }: { posterior: PosteriorInfo }): JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <StatCard label="Posterior Mean" value={`${(posterior.posterior_mean * 100).toFixed(2)}%`} />
      <StatCard label="90% HPDR" value={`[${(posterior.hpdr_90[0] * 100).toFixed(1)}%, ${(posterior.hpdr_90[1] * 100).toFixed(1)}%]`} />
      <StatCard label="95% HPDR" value={`[${(posterior.hpdr_95[0] * 100).toFixed(1)}%, ${(posterior.hpdr_95[1] * 100).toFixed(1)}%]`} />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }): JSX.Element {
  return (
    <div className="bg-zinc-800 rounded p-3">
      <p className="text-zinc-500 text-xs">{label}</p>
      <p className="text-zinc-100 font-mono font-semibold">{value}</p>
      {sub && <p className="text-zinc-500 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function Tooltip_({ text }: { text: string }): JSX.Element {
  return (
    <div className="group relative">
      <Info size={12} className="text-zinc-600 cursor-help" />
      <div className="absolute left-6 top-0 z-10 hidden group-hover:block bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded p-2 w-56 shadow-lg">
        {text}
      </div>
    </div>
  );
}
