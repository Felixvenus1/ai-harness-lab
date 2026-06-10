// Purpose: Main evaluation workbench page — orchestrates all evaluation sub-panels.

import type { JSX } from "react";
import { useState } from "react";
import { Upload, Play, BarChart2, GitCompare, Shield, Scale, History } from "lucide-react";
import { DatasetUploader } from "./DatasetUploader";
import { BenchmarkRunner } from "./BenchmarkRunner";
import { MetricsDashboard } from "./MetricsDashboard";
import { CompareView } from "./CompareView";
import { RobustnessLab } from "./RobustnessLab";
import { JudgeConfigurator, type JudgeSettings } from "./JudgeConfigurator";
import { ExperimentHistory } from "./ExperimentHistory";
import type { DatasetMeta, RunDetail } from "../services/evaluationClient";
import { getRun } from "../services/evaluationClient";

type Tab = "dataset" | "runner" | "metrics" | "compare" | "robustness" | "judge" | "history";

const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: "dataset", label: "Dataset", icon: <Upload size={13} /> },
  { id: "runner", label: "Runner", icon: <Play size={13} /> },
  { id: "metrics", label: "Metrics", icon: <BarChart2 size={13} /> },
  { id: "compare", label: "Compare", icon: <GitCompare size={13} /> },
  { id: "robustness", label: "Robustness", icon: <Shield size={13} /> },
  { id: "judge", label: "Judge", icon: <Scale size={13} /> },
  { id: "history", label: "History", icon: <History size={13} /> },
];

const DEFAULT_JUDGE: JudgeSettings = {
  provider: "mock",
  model: "mock",
  mode: "pointwise",
  rubric: "",
  scale: "1-5",
  juryModels: [],
};

export function EvaluationPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>("dataset");
  const [activeDataset, setActiveDataset] = useState<DatasetMeta | null>(null);
  const [activeRun, setActiveRun] = useState<RunDetail | null>(null);
  const [judgeSettings, setJudgeSettings] = useState<JudgeSettings>(DEFAULT_JUDGE);
  const [compareRunIds, setCompareRunIds] = useState<[string, string]>(["", ""]);

  async function handleSelectRun(id: string) {
    try {
      const run = await getRun(id);
      setActiveRun(run);
      setTab("metrics");
    } catch { /* ignore */ }
  }

  function handleSelectForCompare(id: string, slot: 0 | 1) {
    setCompareRunIds((prev) => {
      const next: [string, string] = [...prev] as [string, string];
      next[slot] = id;
      return next;
    });
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-950">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 h-12 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <span className="text-teal-400 font-semibold text-sm tracking-wide">AI Harness Lab</span>
        <div className="w-px h-4 bg-zinc-700" />
        <span className="text-zinc-300 text-sm">Evaluation Workbench</span>
        {activeDataset && (
          <>
            <div className="w-px h-4 bg-zinc-700" />
            <span className="text-zinc-500 text-xs">Dataset: <span className="text-zinc-300">{activeDataset.name}</span> ({activeDataset.row_count} rows)</span>
          </>
        )}
        {activeRun && (
          <>
            <div className="w-px h-4 bg-zinc-700" />
            <span className="text-zinc-500 text-xs">Run: <span className="text-zinc-300 font-mono">{activeRun.run_id.slice(0, 8)}…</span></span>
          </>
        )}
      </header>

      {/* Tab bar */}
      <nav className="flex items-center gap-0.5 px-3 h-10 bg-zinc-900 border-b border-zinc-800 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 h-8 rounded text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {tab === "dataset" && (
            <div className="space-y-4">
              <h2 className="text-zinc-200 font-semibold text-sm">Upload Evaluation Dataset</h2>
              <DatasetUploader onDatasetReady={(d) => { setActiveDataset(d); }} />
            </div>
          )}

          {tab === "runner" && (
            <BenchmarkRunner
              onRunComplete={(run) => {
                setActiveRun(run);
                setTab("metrics");
              }}
            />
          )}

          {tab === "metrics" && activeRun && (
            <MetricsDashboard run={activeRun} />
          )}

          {tab === "metrics" && !activeRun && (
            <EmptyState message="No run loaded. Go to Runner to start a benchmark, or select a run from History." />
          )}

          {tab === "compare" && <CompareView />}

          {tab === "robustness" && (
            <RobustnessLab runSummary={activeRun?.summary} />
          )}

          {tab === "judge" && (
            <JudgeConfigurator settings={judgeSettings} onChange={setJudgeSettings} />
          )}

          {tab === "history" && (
            <ExperimentHistory
              onSelectRun={handleSelectRun}
              selectedRunIds={compareRunIds}
              onSelectForCompare={handleSelectForCompare}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }): JSX.Element {
  return (
    <div className="flex items-center justify-center h-48 text-zinc-600 text-sm text-center">
      {message}
    </div>
  );
}
