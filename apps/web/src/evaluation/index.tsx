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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Tab bar */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0 20px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-secondary)",
          height: 44,
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 0",
              border: "none",
              borderBottom: `2px solid ${tab === t.id ? "var(--accent-primary)" : "transparent"}`,
              color: tab === t.id ? "var(--accent-primary)" : "var(--text-secondary)",
              background: "transparent",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "color 0.2s, border-color 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
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
