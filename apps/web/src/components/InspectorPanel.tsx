// Purpose: Render the selected node's config as an editable form in the right panel.

import { useState, useEffect, type JSX } from "react";
import { X, Trash2 } from "lucide-react";
import type { Node } from "reactflow";
import { NODE_META } from "../config/nodeConfig";
import type { NodeType, NodeConfig } from "../types/flow";
import type { HarnessNodeData } from "../nodes/HarnessNode";

interface InspectorPanelProps {
  node: Node<HarnessNodeData>;
  onUpdate: (id: string, config: NodeConfig) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function InspectorPanel({
  node,
  onUpdate,
  onDelete,
  onClose,
}: InspectorPanelProps): JSX.Element {
  const { nodeType, config } = node.data;
  const meta = NODE_META[nodeType];
  const { Icon } = meta;

  // Local form state — keeps textarea values as strings while editing.
  const [form, setForm] = useState<Record<string, string | boolean>>(initForm);

  function initForm(): Record<string, string | boolean> {
    const f: Record<string, string | boolean> = {};
    for (const field of meta.fields) {
      const val = (config as Record<string, unknown>)[field.key];
      if (field.type === "boolean") {
        f[field.key] = val === true;
      } else if (
        field.key === "json_schema" &&
        val != null &&
        typeof val === "object"
      ) {
        f[field.key] = JSON.stringify(val, null, 2);
      } else {
        f[field.key] = val != null ? String(val) : "";
      }
    }
    return f;
  }

  // Sync form when a different node is selected.
  useEffect(() => {
    setForm(initForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, nodeType]);

  function commit(key: string, value: string | boolean) {
    const updated = { ...(config as Record<string, unknown>) };
    if (key === "json_schema") {
      try {
        updated[key] = typeof value === "string" ? JSON.parse(value) : value;
      } catch {
        return; // keep last valid value; don't update parent on bad JSON
      }
    } else if (typeof value === "boolean") {
      updated[key] = value;
    } else if (value === "") {
      updated[key] = undefined;
    } else {
      const num = Number(value);
      updated[key] = Number.isNaN(num) ? value : num;
    }
    onUpdate(node.id, updated as NodeConfig);
  }

  return (
    <aside className="w-72 shrink-0 bg-zinc-900 border-l border-zinc-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-3 py-2 border-b border-zinc-800 ${meta.bgClass}`}
      >
        <Icon size={13} className={meta.iconColorClass} />
        <span className="text-xs font-semibold text-zinc-200 flex-1">{meta.label}</span>
        <button
          type="button"
          onClick={() => {
            onDelete(node.id);
            onClose();
          }}
          className="text-zinc-500 hover:text-red-400 transition-colors p-0.5 rounded"
          title="Delete node"
        >
          <Trash2 size={12} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-200 transition-colors p-0.5 rounded"
          title="Close inspector"
        >
          <X size={12} />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {meta.fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              {field.label}
            </label>

            {field.type === "boolean" ? (
              <button
                type="button"
                role="switch"
                aria-checked={!!form[field.key]}
                onClick={() => {
                  const next = !form[field.key];
                  setForm((f) => ({ ...f, [field.key]: next }));
                  commit(field.key, next);
                }}
                className={[
                  "w-9 h-5 rounded-full transition-colors relative self-start",
                  form[field.key] ? "bg-teal-600" : "bg-zinc-700",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    form[field.key] ? "translate-x-4" : "translate-x-0.5",
                  ].join(" ")}
                />
              </button>
            ) : field.type === "select" ? (
              <select
                value={String(form[field.key] ?? "")}
                onChange={(e) => {
                  setForm((f) => ({ ...f, [field.key]: e.target.value }));
                  commit(field.key, e.target.value);
                }}
                className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5 outline-none focus:border-teal-500 transition-colors"
              >
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                value={String(form[field.key] ?? "")}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [field.key]: e.target.value }))
                }
                onBlur={(e) => commit(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={field.key === "json_schema" ? 5 : 3}
                className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5 outline-none focus:border-teal-500 transition-colors resize-y font-mono"
              />
            ) : (
              <input
                type={field.type === "number" ? "number" : "text"}
                value={String(form[field.key] ?? "")}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [field.key]: e.target.value }))
                }
                onBlur={(e) => commit(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5 outline-none focus:border-teal-500 transition-colors"
              />
            )}
          </div>
        ))}
        {meta.fields.length === 0 && (
          <p className="text-zinc-600 text-xs italic">No configuration for this node.</p>
        )}
      </div>

      {/* Footer: node ID */}
      <div className="px-3 py-2 border-t border-zinc-800">
        <p className="text-[9px] text-zinc-600 font-mono truncate">id: {node.id}</p>
      </div>
    </aside>
  );
}
