// Purpose: Guardrail policy management — toggle policies, run ad-hoc checks, view stats.

import type { JSX } from "react";
import { useState, useEffect } from "react";
import { RefreshCw, Plus, Trash2, ToggleLeft, ToggleRight, Play } from "lucide-react";
import {
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  checkText,
  getPolicyStats,
} from "../services/observabilityClient";
import type { PolicyAction, PolicyConfig, PolicyStats, PolicyType } from "../types/observability";

const POLICY_TYPES: PolicyType[] = [
  "pii",
  "hate",
  "dangerous_intent",
  "prompt_injection",
  "output_format",
  "sensitive_redaction",
];

const ACTION_STYLE: Record<PolicyAction, string> = {
  allow: "text-teal-400",
  warn: "text-yellow-400",
  redact: "text-blue-400",
  block: "text-red-400",
};

const TYPE_LABEL: Record<PolicyType, string> = {
  pii: "PII Detection",
  hate: "Hate / Harassment",
  dangerous_intent: "Dangerous Intent",
  prompt_injection: "Prompt Injection",
  output_format: "Output Format",
  sensitive_redaction: "Sensitive Redaction",
};

function PolicyRow({
  config,
  onToggle,
  onDelete,
}: {
  config: PolicyConfig;
  onToggle: () => void;
  onDelete: () => void;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border border-zinc-800 rounded text-xs hover:border-zinc-700 transition-colors">
      <button
        onClick={onToggle}
        className={`shrink-0 transition-colors ${config.enabled ? "text-teal-400" : "text-zinc-600"}`}
        title={config.enabled ? "Disable" : "Enable"}
      >
        {config.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-zinc-200">{config.name}</span>
        <span className="text-zinc-500 ml-2">{TYPE_LABEL[config.type]}</span>
      </div>
      <span className={`shrink-0 font-mono ${ACTION_STYLE[config.action]}`}>
        {config.action}
      </span>
      <button
        onClick={onDelete}
        className="text-zinc-600 hover:text-red-400 transition-colors shrink-0"
        title="Delete"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export function GuardrailsTab(): JSX.Element {
  const [policies, setPolicies] = useState<PolicyConfig[]>([]);
  const [stats, setStats] = useState<PolicyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  // New policy form state
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<PolicyType>("pii");
  const [newAction, setNewAction] = useState<PolicyAction>("warn");

  // Ad-hoc check state
  const [checkInput, setCheckInput] = useState("");
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [pl, st] = await Promise.all([listPolicies(), getPolicyStats()]);
      setPolicies(pl);
      setStats(st);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(config: PolicyConfig) {
    await updatePolicy(config.policy_id, { ...config, enabled: !config.enabled });
    await load();
  }

  async function handleDelete(policyId: string) {
    await deletePolicy(policyId);
    await load();
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    await createPolicy({
      policy_id: "",
      name: newName.trim(),
      type: newType,
      action: newAction,
      enabled: true,
      params: {},
    });
    setNewName("");
    setAdding(false);
    await load();
  }

  async function handleCheck() {
    if (!checkInput.trim()) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const result = await checkText(checkInput.trim());
      setCheckResult(JSON.stringify(result, null, 2));
    } catch (e) {
      setCheckResult(String(e));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 overflow-y-auto h-full">
      {/* Stats */}
      {stats && (
        <div>
          <div className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Policy Statistics</div>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="bg-zinc-800 rounded px-3 py-2">
              <div className="text-zinc-500">Evaluations</div>
              <div className="text-zinc-100 font-mono">{stats.total_evaluations}</div>
            </div>
            <div className="bg-zinc-800 rounded px-3 py-2">
              <div className="text-zinc-500">Redact rate</div>
              <div className="text-blue-400 font-mono">{(stats.redact_rate * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-zinc-800 rounded px-3 py-2">
              <div className="text-zinc-500">Warn rate</div>
              <div className="text-yellow-400 font-mono">{(stats.warn_rate * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-zinc-800 rounded px-3 py-2">
              <div className="text-zinc-500">Review queue</div>
              <div className="text-orange-400 font-mono">{stats.false_positive_queue_size}</div>
            </div>
          </div>
          {Object.keys(stats.block_rate_by_type).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(stats.block_rate_by_type).map(([type, rate]) => (
                <span key={type} className="text-[10px] px-2 py-0.5 border border-zinc-700 rounded text-zinc-400">
                  {type}: {(rate * 100).toFixed(1)}% block
                </span>
              ))}
            </div>
          )}
          {stats.sample_note && (
            <div className="text-yellow-500 text-xs mt-1">⚠ {stats.sample_note}</div>
          )}
        </div>
      )}

      {/* Policy list */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-zinc-500 text-xs uppercase tracking-wide flex-1">
            Policies ({policies.length})
          </span>
          <button
            onClick={load}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {policies.length === 0 && !loading && (
          <div className="text-zinc-600 text-xs text-center py-4">
            No policies configured. Add one below or seed with examples.
          </div>
        )}

        <div className="space-y-1">
          {policies.map((p) => (
            <PolicyRow
              key={p.policy_id}
              config={p}
              onToggle={() => handleToggle(p)}
              onDelete={() => handleDelete(p.policy_id)}
            />
          ))}
        </div>
      </div>

      {/* Add policy */}
      <div className="border border-zinc-700 rounded p-3 bg-zinc-900/60">
        <div className="text-zinc-400 text-xs mb-2 flex items-center gap-1">
          <Plus size={11} /> Add Policy
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Policy name…"
            className="flex-1 min-w-32 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as PolicyType)}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
          >
            {POLICY_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
          <select
            value={newAction}
            onChange={(e) => setNewAction(e.target.value as PolicyAction)}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
          >
            <option value="allow">allow</option>
            <option value="warn">warn</option>
            <option value="redact">redact</option>
            <option value="block">block</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || adding}
            className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded disabled:opacity-50 transition-colors"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      {/* Ad-hoc check */}
      <div className="border border-zinc-700 rounded p-3 bg-zinc-900/60">
        <div className="text-zinc-400 text-xs mb-2 flex items-center gap-1">
          <Play size={11} /> Ad-hoc Check
        </div>
        <textarea
          value={checkInput}
          onChange={(e) => setCheckInput(e.target.value)}
          placeholder="Enter text to check against all enabled policies…"
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono resize-none"
        />
        <button
          onClick={handleCheck}
          disabled={!checkInput.trim() || checking}
          className="mt-2 px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded disabled:opacity-50 transition-colors"
        >
          {checking ? "Checking…" : "Run Check"}
        </button>
        {checkResult && (
          <pre className="mt-2 text-[10px] text-zinc-300 bg-zinc-800 rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap">
            {checkResult}
          </pre>
        )}
      </div>
    </div>
  );
}
