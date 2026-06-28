// Purpose: List starter flows and backend-saved flows; allow load and delete.

import { useState, useEffect, useCallback, type JSX } from "react";
import { FolderOpen, Cloud, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { STARTER_FLOWS } from "../config/examples";
import type { StarterFlow } from "../config/examples";
import { listFlows, loadFlow, deleteFlow, type SavedFlowMeta } from "../services/apiClient";
import type { FlowGraph } from "../types/flow";

interface FlowsPanelProps {
  onLoad: (flow: StarterFlow) => void;
  onLoadSaved: (graph: FlowGraph, name: string) => void;
}

export function FlowsPanel({ onLoad, onLoadSaved }: FlowsPanelProps): JSX.Element {
  const [saved, setSaved] = useState<SavedFlowMeta[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSaved = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      setSaved(await listFlows());
    } catch {
      setError("Could not reach API");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { void fetchSaved(); }, [fetchSaved]);

  async function handleLoadSaved(meta: SavedFlowMeta) {
    setLoadingId(meta.id);
    try {
      const { graph, name } = await loadFlow(meta.id);
      onLoadSaved(graph, name);
    } catch {
      setError("Failed to load flow");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      await deleteFlow(id);
      setSaved((prev) => prev.filter((f) => f.id !== id));
    } catch {
      setError("Failed to delete flow");
    }
  }

  return (
    <div className="px-2 flex flex-col gap-3">
      {/* ── Starter flows ── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-1 pb-1.5">
          Starter Flows
        </p>
        <div className="flex flex-col gap-1">
          {STARTER_FLOWS.map((flow) => (
            <button
              key={flow.id}
              type="button"
              onClick={() => onLoad(flow)}
              className="flex items-start gap-2 text-left px-2 py-1.5 rounded border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-zinc-600 transition-all"
            >
              <FolderOpen size={11} style={{ color: "var(--accent-primary)" }} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-zinc-200 font-medium truncate">{flow.name}</p>
                <p className="text-[10px] text-zinc-500 truncate leading-tight mt-0.5">{flow.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Saved flows ── */}
      <div>
        <div className="flex items-center justify-between px-1 pb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Saved Flows
          </p>
          <button
            type="button"
            onClick={() => void fetchSaved()}
            disabled={fetching}
            title="Refresh"
            className="text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            {fetching
              ? <Loader2 size={10} className="animate-spin" />
              : <RefreshCw size={10} />
            }
          </button>
        </div>

        {error && (
          <p className="text-[10px] text-red-400 px-1 mb-1">{error}</p>
        )}

        {!fetching && saved.length === 0 && (
          <p className="text-[10px] text-zinc-600 px-1 italic">No saved flows yet.</p>
        )}

        <div className="flex flex-col gap-1">
          {saved.map((meta) => (
            <button
              key={meta.id}
              type="button"
              onClick={() => void handleLoadSaved(meta)}
              disabled={loadingId === meta.id}
              className="group flex items-start gap-2 text-left px-2 py-1.5 rounded border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-zinc-600 transition-all disabled:opacity-60"
            >
              {loadingId === meta.id
                ? <Loader2 size={11} className="animate-spin mt-0.5 shrink-0 text-zinc-400" />
                : <Cloud size={11} className="mt-0.5 shrink-0 text-sky-500" />
              }
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-200 font-medium truncate">{meta.name}</p>
                <p className="text-[10px] text-zinc-500 truncate leading-tight mt-0.5">
                  {meta.node_count} nodes · {meta.edge_count} edges
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => void handleDelete(e, meta.id)}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-0.5 rounded shrink-0"
                title="Delete"
              >
                <Trash2 size={10} />
              </button>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
