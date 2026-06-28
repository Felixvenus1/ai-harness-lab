// Purpose: Inspect and edit a selected connector's policy, routing rule, and metadata.

import { useState, useEffect, type JSX } from "react";
import { X, Trash2, ArrowRight } from "lucide-react";
import type { Edge } from "reactflow";
import type { ConnectorConfig, ConnectorPolicy } from "../types/flow";

interface ConnectorInspectorProps {
  edge: Edge<ConnectorConfig>;
  onUpdate: (edgeId: string, data: Partial<ConnectorConfig>) => void;
  onDelete: (edgeId: string) => void;
  onClose: () => void;
}

type Tab = "routing" | "policy";

const RULE_OPTIONS: Array<{ value: ConnectorPolicy["routing_rule"]; label: string; hint: string }> = [
  { value: "always",       label: "Always",       hint: "Connector fires on every execution." },
  { value: "on_success",   label: "On Success",   hint: "Fires only when the source node passed." },
  { value: "on_failure",   label: "On Failure",   hint: "Fires only when the source node failed." },
  { value: "on_condition", label: "On Condition", hint: "Fires when the expression evaluates to true." },
];

function initPolicy(data?: ConnectorConfig): ConnectorPolicy {
  return {
    routing_rule: data?.policy?.routing_rule ?? "always",
    condition:        data?.policy?.condition ?? "",
    retry_limit:      data?.policy?.retry_limit ?? 0,
    retry_delay_ms:   data?.policy?.retry_delay_ms ?? 500,
    timeout_ms:       data?.policy?.timeout_ms ?? undefined,
    cost_limit_usd:   data?.policy?.cost_limit_usd ?? undefined,
    log_on_traverse:  data?.policy?.log_on_traverse ?? false,
  };
}

export function ConnectorInspector({
  edge,
  onUpdate,
  onDelete,
  onClose,
}: ConnectorInspectorProps): JSX.Element {
  const [tab, setTab] = useState<Tab>("routing");
  const [label, setLabel] = useState(edge.data?.label ?? "");
  const [policy, setPolicy] = useState<ConnectorPolicy>(() => initPolicy(edge.data));

  // Re-sync when a different edge is selected.
  useEffect(() => {
    setLabel(edge.data?.label ?? "");
    setPolicy(initPolicy(edge.data));
    setTab("routing");
  }, [edge.id]);

  function commitLabel(value: string) {
    setLabel(value);
    onUpdate(edge.id, { label: value || undefined });
  }

  function commitPolicy(patch: Partial<ConnectorPolicy>) {
    const next = { ...policy, ...patch };
    setPolicy(next);
    onUpdate(edge.id, { policy: next });
  }

  const inputClass =
    "bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5 outline-none focus:border-violet-500 transition-colors w-full";
  const labelClass = "text-[10px] font-medium uppercase tracking-wider text-zinc-500";

  return (
    <aside className="w-72 shrink-0 bg-zinc-900 border-l border-zinc-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-violet-950/40">
        <ArrowRight size={13} className="text-violet-400" />
        <span className="text-xs font-semibold text-zinc-200 flex-1">Connector</span>
        <button
          type="button"
          onClick={() => {
            onDelete(edge.id);
            onClose();
          }}
          className="text-zinc-500 hover:text-red-400 transition-colors p-0.5 rounded"
          title="Delete connector"
        >
          <Trash2 size={12} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-200 transition-colors p-0.5 rounded"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>

      {/* Source → Target breadcrumb */}
      <div className="px-3 py-2 border-b border-zinc-800/60">
        <p className="text-[10px] text-zinc-500 font-mono truncate">
          {edge.source}
          {edge.sourceHandle ? `[${edge.sourceHandle}]` : ""}
          {" → "}
          {edge.target}
          {edge.targetHandle ? `[${edge.targetHandle}]` : ""}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {(["routing", "policy"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              "flex-1 text-[10px] font-semibold uppercase tracking-wider py-1.5 transition-colors",
              tab === t
                ? "text-violet-400 border-b-2 border-violet-500"
                : "text-zinc-500 hover:text-zinc-300",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {tab === "routing" && (
          <>
            {/* Label */}
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={(e) => commitLabel(e.target.value)}
                placeholder="Optional display label"
                className={inputClass}
              />
            </div>

            {/* Routing rule */}
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Routing Rule</label>
              {RULE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => commitPolicy({ routing_rule: opt.value })}
                  className={[
                    "text-left px-2.5 py-2 rounded border text-xs transition-colors",
                    policy.routing_rule === opt.value
                      ? "bg-violet-900/40 border-violet-500/60 text-violet-200"
                      : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-500",
                  ].join(" ")}
                >
                  <span className="font-semibold">{opt.label}</span>
                  <span className="block text-[10px] text-zinc-500 mt-0.5">{opt.hint}</span>
                </button>
              ))}
            </div>

            {/* Condition expression — shown for on_condition only */}
            {policy.routing_rule === "on_condition" && (
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Condition Expression</label>
                <textarea
                  value={policy.condition ?? ""}
                  onChange={(e) => setPolicy((p) => ({ ...p, condition: e.target.value }))}
                  onBlur={(e) => commitPolicy({ condition: e.target.value })}
                  placeholder='passed == True&#10;output == "escalate"'
                  rows={3}
                  className={`${inputClass} resize-y font-mono`}
                />
                <p className="text-[10px] text-zinc-600">
                  Available: <code className="text-zinc-400">passed</code> (bool),{" "}
                  <code className="text-zinc-400">output</code> (any)
                </p>
              </div>
            )}
          </>
        )}

        {tab === "policy" && (
          <>
            {/* Retry */}
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Retry Limit</label>
              <input
                type="number"
                min={0}
                max={10}
                value={policy.retry_limit ?? 0}
                onChange={(e) => commitPolicy({ retry_limit: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Retry Delay (ms)</label>
              <input
                type="number"
                min={0}
                value={policy.retry_delay_ms ?? 500}
                onChange={(e) => commitPolicy({ retry_delay_ms: Number(e.target.value) })}
                className={inputClass}
              />
            </div>

            {/* Timeout */}
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Timeout (ms)</label>
              <input
                type="number"
                min={0}
                value={policy.timeout_ms ?? ""}
                onChange={(e) =>
                  commitPolicy({
                    timeout_ms: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="none"
                className={inputClass}
              />
            </div>

            {/* Cost limit */}
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Cost Limit (USD)</label>
              <input
                type="number"
                step="0.001"
                min={0}
                value={policy.cost_limit_usd ?? ""}
                onChange={(e) =>
                  commitPolicy({
                    cost_limit_usd: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="none"
                className={inputClass}
              />
            </div>

            {/* Log on traverse toggle */}
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Log on Traverse</label>
              <button
                type="button"
                role="switch"
                aria-checked={!!policy.log_on_traverse}
                onClick={() => commitPolicy({ log_on_traverse: !policy.log_on_traverse })}
                className={[
                  "w-9 h-5 rounded-full transition-colors relative self-start",
                  policy.log_on_traverse ? "bg-violet-600" : "bg-zinc-700",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    policy.log_on_traverse ? "translate-x-4" : "translate-x-0.5",
                  ].join(" ")}
                />
              </button>
              <p className="text-[10px] text-zinc-600">Emit a span every time this connector is traversed.</p>
            </div>
          </>
        )}
      </div>

      {/* Footer: edge ID */}
      <div className="px-3 py-2 border-t border-zinc-800">
        <p className="text-[9px] text-zinc-600 font-mono truncate">id: {edge.id}</p>
      </div>
    </aside>
  );
}
