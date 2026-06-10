// Purpose: Robustness lab — perturbation configuration and degradation results.

import type { JSX } from "react";
import { useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { perturbInput } from "../services/evaluationClient";

const ALL_STRATEGIES = [
  { id: "casing", label: "Casing", desc: "Upper/lower/mixed case" },
  { id: "whitespace", label: "Whitespace", desc: "Extra spaces/newlines" },
  { id: "typo_inject", label: "Typos", desc: "Character-level errors" },
  { id: "synonym_swap", label: "Synonyms", desc: "Word substitution" },
  { id: "truncation", label: "Truncation", desc: "Remove trailing text" },
  { id: "adversarial", label: "Adversarial", desc: "Injection suffixes" },
  { id: "noise_append", label: "Noise", desc: "Append irrelevant text" },
];

interface RobustnessLabProps {
  runSummary?: any;
}

export function RobustnessLab({ runSummary }: RobustnessLabProps): JSX.Element {
  const [strategies, setStrategies] = useState<string[]>(["casing", "whitespace", "typo_inject"]);
  const [testInput, setTestInput] = useState("");
  const [nVariants, setNVariants] = useState(5);
  const [variants, setVariants] = useState<{ strategy: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  function toggleStrategy(id: string) {
    setStrategies((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleGenerate() {
    if (!testInput) return;
    setLoading(true);
    try {
      const r = await perturbInput(testInput, strategies, nVariants);
      setVariants(r.variants);
    } catch {
      setVariants([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-zinc-200 font-semibold text-sm flex items-center gap-2">
        <Shield size={14} /> Robustness Lab
      </h2>

      {/* Strategy selector */}
      <div className="space-y-2">
        <label className="text-zinc-400 text-xs">Perturbation Strategies</label>
        <div className="grid grid-cols-2 gap-2">
          {ALL_STRATEGIES.map((s) => (
            <button
              key={s.id}
              onClick={() => toggleStrategy(s.id)}
              className={`flex items-start gap-2 text-left px-3 py-2 rounded border transition-colors ${
                strategies.includes(s.id)
                  ? "border-teal-600 bg-teal-950/30 text-teal-300"
                  : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              <div>
                <p className="text-xs font-medium">{s.label}</p>
                <p className="text-xs opacity-70">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Variants count */}
      <div className="space-y-1">
        <label className="text-zinc-400 text-xs">Variants per row: {nVariants}</label>
        <input type="range" min={1} max={20} value={nVariants} onChange={(e) => setNVariants(Number(e.target.value))} className="w-full accent-teal-500" />
      </div>

      {/* Test input */}
      <div className="space-y-2 border-t border-zinc-800 pt-4">
        <p className="text-zinc-400 text-xs font-medium">Preview Perturbations</p>
        <textarea
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          rows={3}
          placeholder="Enter a sample input to preview perturbations…"
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 text-xs outline-none focus:border-teal-500 resize-none"
        />
        <button
          onClick={handleGenerate}
          disabled={!testInput || strategies.length === 0 || loading}
          className="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-200 px-3 py-1.5 rounded text-xs transition-colors"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
          Generate perturbations
        </button>
      </div>

      {variants.length > 0 && (
        <div className="space-y-2">
          <p className="text-zinc-500 text-xs">{variants.length} variant(s)</p>
          {variants.map((v, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded p-3">
              <span className="inline-block px-1.5 py-0.5 text-xs rounded bg-zinc-700 text-zinc-300 mb-1">{v.strategy}</span>
              <p className="text-zinc-200 text-xs font-mono whitespace-pre-wrap break-words">{v.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Robustness metrics from run */}
      {runSummary?.robustness && (
        <div className="border-t border-zinc-800 pt-4 space-y-3">
          <p className="text-zinc-300 text-sm font-medium">Robustness Results</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-800 rounded p-3">
              <p className="text-zinc-500 text-xs">Attack Success Rate</p>
              <p className="text-red-400 font-mono font-semibold">{(runSummary.robustness.asr * 100).toFixed(1)}%</p>
            </div>
            <div className="bg-zinc-800 rounded p-3">
              <p className="text-zinc-500 text-xs">Mean Degradation</p>
              <p className="text-amber-400 font-mono font-semibold">{runSummary.robustness.mean_degradation?.toFixed(3)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
