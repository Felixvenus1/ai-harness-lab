// Purpose: Feedback list, category breakdown, and regression dataset creation.

import type { JSX } from "react";
import { useState, useEffect } from "react";
import { RefreshCw, Download, Plus } from "lucide-react";
import {
  listFeedback,
  getFeedbackStats,
  createRegressionDataset,
  listRegressionDatasets,
  regressionDatasetExportUrl,
} from "../services/observabilityClient";
import type {
  Feedback,
  FeedbackStats,
  RegressionDatasetMeta,
} from "../types/observability";

const SIGNAL_STYLE = {
  thumbs_up: "text-teal-400 bg-teal-950/30 border-teal-700",
  thumbs_down: "text-red-400 bg-red-950/30 border-red-700",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-zinc-800 rounded px-3 py-2 text-xs">
      <div className="text-zinc-500">{label}</div>
      <div className="text-zinc-100 font-mono text-sm mt-0.5">{value}</div>
    </div>
  );
}

export function FeedbackTab(): JSX.Element {
  const [items, setItems] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [regressions, setRegressions] = useState<RegressionDatasetMeta[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [fb, st, reg] = await Promise.all([
        listFeedback({ limit: 200 }),
        getFeedbackStats(),
        listRegressionDatasets(),
      ]);
      setItems(fb);
      setStats(st);
      setRegressions(reg);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCreateDataset() {
    if (!createName.trim() || selected.size === 0) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createRegressionDataset({
        feedback_ids: [...selected],
        name: createName.trim(),
      });
      setCreateName("");
      setSelected(new Set());
      await load();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      {/* Stats */}
      {stats && (
        <div>
          <div className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Summary</div>
          <div className="flex flex-wrap gap-2">
            <StatCard label="Total feedback" value={stats.total} />
            <StatCard label="👍 Thumbs up" value={`${(stats.thumbs_up_rate * 100).toFixed(1)}% (${stats.thumbs_up})`} />
            <StatCard label="👎 Thumbs down" value={`${(stats.thumbs_down_rate * 100).toFixed(1)}% (${stats.thumbs_down})`} />
          </div>
          {Object.keys(stats.category_counts).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(stats.category_counts)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, count]) => (
                  <span
                    key={cat}
                    className="text-[10px] px-2 py-0.5 rounded border border-zinc-700 text-zinc-400"
                  >
                    {cat}: {count}
                  </span>
                ))}
            </div>
          )}
          {stats.sample_note && (
            <div className="text-yellow-500 text-xs mt-1">⚠ {stats.sample_note}</div>
          )}
        </div>
      )}

      {/* Feedback list */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-zinc-500 text-xs uppercase tracking-wide flex-1">
            Feedback ({items.length})
          </span>
          <button
            onClick={load}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {items.length === 0 && !loading && (
          <div className="text-zinc-600 text-xs text-center py-6">
            No feedback yet. Use the trace viewer after running a flow.
          </div>
        )}

        <div className="space-y-1">
          {items.map((fb) => (
            <label
              key={fb.feedback_id}
              className="flex items-start gap-2 p-2 rounded border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(fb.feedback_id)}
                onChange={() => toggleSelect(fb.feedback_id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${SIGNAL_STYLE[fb.signal]}`}
                  >
                    {fb.signal === "thumbs_up" ? "👍" : "👎"}
                  </span>
                  {fb.categories.map((c) => (
                    <span key={c} className="text-[10px] text-zinc-500 border border-zinc-700 rounded px-1">
                      {c}
                    </span>
                  ))}
                  <span className="text-[10px] text-zinc-600 ml-auto">
                    {new Date(fb.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-zinc-400 font-mono truncate mt-0.5">
                  trace: {fb.trace_id}
                </div>
                {fb.note && (
                  <div className="text-xs text-zinc-400 mt-0.5 italic">"{fb.note}"</div>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Create regression dataset */}
      {selected.size > 0 && (
        <div className="border border-zinc-700 rounded p-3 bg-zinc-900/60">
          <div className="text-zinc-400 text-xs mb-2">
            Create regression dataset from {selected.size} selected item(s)
          </div>
          <div className="flex gap-2">
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Dataset name…"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            <button
              onClick={handleCreateDataset}
              disabled={!createName.trim() || creating}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-teal-700 hover:bg-teal-600 text-white rounded disabled:opacity-50 transition-colors"
            >
              <Plus size={11} />
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
          {createError && <div className="text-red-400 text-xs mt-1">{createError}</div>}
        </div>
      )}

      {/* Regression datasets */}
      {regressions.length > 0 && (
        <div>
          <div className="text-zinc-500 text-xs uppercase tracking-wide mb-2">
            Regression Datasets
          </div>
          <div className="space-y-1">
            {regressions.map((ds) => (
              <div
                key={ds.dataset_id}
                className="flex items-center gap-3 px-3 py-2 border border-zinc-800 rounded text-xs"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-zinc-200">{ds.name}</span>
                  <span className="text-zinc-500 ml-2">{ds.row_count} rows</span>
                  <span className="text-zinc-600 ml-2">
                    {new Date(ds.created_at).toLocaleDateString()}
                  </span>
                </div>
                <a
                  href={regressionDatasetExportUrl(ds.dataset_id, "json")}
                  download
                  className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="Download JSON"
                >
                  <Download size={12} /> JSON
                </a>
                <a
                  href={regressionDatasetExportUrl(ds.dataset_id, "csv")}
                  download
                  className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="Download CSV"
                >
                  <Download size={12} /> CSV
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
