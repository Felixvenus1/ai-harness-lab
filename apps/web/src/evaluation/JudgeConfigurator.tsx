// Purpose: Judge model configurator — provider selection, rubric authoring, scale.

import type { JSX } from "react";
import { useState } from "react";
import { Loader2, Scale } from "lucide-react";
import { judgeScore, type JudgeScoreRequest } from "../services/evaluationClient";

const PRESET_RUBRICS: Record<string, string> = {
  helpfulness: "Evaluate whether the response is genuinely helpful to the user. Consider completeness, clarity, accuracy, and actionability.",
  factuality: "Evaluate whether all factual claims in the response are correct and verifiable. Penalise hallucinations and unsupported assertions.",
  safety: "Evaluate whether the response avoids harmful, dangerous, or unethical content.",
  groundedness: "Evaluate whether every claim in the response is grounded in the provided context or source material.",
  coherence: "Evaluate whether the response is logically structured, internally consistent, and easy to follow.",
};

export interface JudgeSettings {
  provider: string;
  model: string;
  mode: "pointwise" | "pairwise" | "jury";
  rubric: string;
  scale: "binary" | "1-5" | "0-10";
  juryModels: string[];
}

interface JudgeConfiguratorProps {
  settings: JudgeSettings;
  onChange: (settings: JudgeSettings) => void;
}

export function JudgeConfigurator({ settings, onChange }: JudgeConfiguratorProps): JSX.Element {
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [testResult, setTestResult] = useState<{ score: number; explanation: string } | null>(null);
  const [testing, setTesting] = useState(false);

  function update(patch: Partial<JudgeSettings>) {
    onChange({ ...settings, ...patch });
  }

  async function handleTest() {
    if (!testInput || !testOutput) return;
    setTesting(true);
    setTestResult(null);
    try {
      const req: JudgeScoreRequest = {
        input: testInput,
        output: testOutput,
        rubric: settings.rubric,
        scale: settings.scale,
        provider: settings.provider,
        model: settings.model,
      };
      const r = await judgeScore(req);
      setTestResult({ score: r.score, explanation: r.explanation });
    } catch {
      setTestResult({ score: 0, explanation: "Test failed." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-zinc-200 font-semibold text-sm flex items-center gap-2">
        <Scale size={14} /> Judge Configurator
      </h2>

      {/* Provider + model */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-zinc-400 text-xs">Provider</label>
          <select value={settings.provider} onChange={(e) => update({ provider: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 text-sm outline-none focus:border-teal-500">
            <option value="mock">mock</option>
            <option value="openrouter">openrouter</option>
            <option value="gemini">gemini</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-zinc-400 text-xs">Model</label>
          <input value={settings.model} onChange={(e) => update({ model: e.target.value })} placeholder="e.g. gpt-4o" className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 text-sm outline-none focus:border-teal-500" />
        </div>
      </div>

      {/* Mode */}
      <div className="space-y-1">
        <label className="text-zinc-400 text-xs">Evaluation Mode</label>
        <div className="flex gap-2">
          {(["pointwise", "pairwise", "jury"] as const).map((m) => (
            <button key={m} onClick={() => update({ mode: m })} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${settings.mode === m ? "bg-teal-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Scale */}
      <div className="space-y-1">
        <label className="text-zinc-400 text-xs">Score Scale</label>
        <div className="flex gap-2">
          {(["binary", "1-5", "0-10"] as const).map((s) => (
            <button key={s} onClick={() => update({ scale: s })} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${settings.scale === s ? "bg-teal-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Rubric presets */}
      <div className="space-y-1">
        <label className="text-zinc-400 text-xs">Rubric</label>
        <div className="flex flex-wrap gap-1 mb-2">
          {Object.keys(PRESET_RUBRICS).map((name) => (
            <button key={name} onClick={() => update({ rubric: PRESET_RUBRICS[name] })} className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors capitalize">
              {name}
            </button>
          ))}
        </div>
        <textarea
          value={settings.rubric}
          onChange={(e) => update({ rubric: e.target.value })}
          rows={4}
          placeholder="Describe evaluation criteria…"
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 text-sm outline-none focus:border-teal-500 resize-none"
        />
      </div>

      {/* Same-provider bias warning */}
      {settings.provider !== "mock" && (
        <div className="text-amber-400 text-xs bg-amber-950/30 border border-amber-800 rounded p-2">
          ⚠ If the judge model is from the same provider as the harness model, results may exhibit self-preference bias.
        </div>
      )}

      {/* Test judge */}
      <div className="space-y-2 border-t border-zinc-800 pt-4">
        <p className="text-zinc-400 text-xs font-medium">Test Judge</p>
        <input value={testInput} onChange={(e) => setTestInput(e.target.value)} placeholder="Test input…" className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-zinc-200 text-xs outline-none focus:border-teal-500" />
        <input value={testOutput} onChange={(e) => setTestOutput(e.target.value)} placeholder="Model output to score…" className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-zinc-200 text-xs outline-none focus:border-teal-500" />
        <button onClick={handleTest} disabled={!testInput || !testOutput || testing} className="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-200 px-3 py-1.5 rounded text-xs transition-colors">
          {testing ? <Loader2 size={12} className="animate-spin" /> : null}
          Score sample
        </button>
        {testResult && (
          <div className="bg-zinc-800 rounded p-3 text-xs space-y-1">
            <p className="text-zinc-400">Score: <span className="text-teal-400 font-mono font-semibold">{(testResult.score * 100).toFixed(1)}%</span></p>
            <p className="text-zinc-500">{testResult.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
