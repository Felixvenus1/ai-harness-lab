// Purpose: Render a single canvas node. Router nodes get named multi-output handles.

import { memo } from "react";
import { Handle, Position } from "reactflow";
import type { NodeProps } from "reactflow";
import { NODE_META } from "../config/nodeConfig";
import type { NodeType, NodeConfig } from "../types/flow";

export interface HarnessNodeData {
  nodeType: NodeType;
  config: NodeConfig;
}

export const HarnessNode = memo(function HarnessNode({
  data,
  selected,
}: NodeProps<HarnessNodeData>) {
  const meta = NODE_META[data.nodeType];
  if (!meta) return null;
  const { Icon, outputHandles } = meta;

  return (
    <div
      className={[
        "harness-node rounded-lg border shadow-lg select-none",
        meta.bgClass,
        meta.borderClass,
        selected ? "ring-2 ring-green-500/50 ring-offset-1 ring-offset-transparent" : "",
      ].join(" ")}
      style={{ padding: "8px 12px", minWidth: 160 }}
    >
      {/* Single target handle — top centre */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-zinc-500 !border-zinc-700"
      />

      <div className="flex items-center gap-2">
        <Icon size={13} className={meta.iconColorClass} />
        <span className="harness-node-label text-xs font-semibold text-zinc-200">
          {meta.label}
        </span>
      </div>

      {data.config.label && (
        <p className="harness-node-sublabel mt-0.5 text-[10px] text-zinc-500 truncate max-w-[180px]">
          {data.config.label}
        </p>
      )}

      {/* Output handles */}
      {outputHandles ? (
        // Router / multi-output: spread named handles evenly across the bottom
        <div className="relative mt-2" style={{ height: 16 }}>
          {outputHandles.map((h, idx) => {
            const pct = ((idx + 1) / (outputHandles.length + 1)) * 100;
            return (
              <div
                key={h.id}
                className="absolute flex flex-col items-center"
                style={{ left: `${pct}%`, transform: "translateX(-50%)", bottom: 0 }}
              >
                <span className="text-[8px] text-zinc-500 mb-0.5 whitespace-nowrap">
                  {h.label}
                </span>
                <Handle
                  type="source"
                  position={Position.Bottom}
                  id={h.id}
                  className="!relative !translate-x-0 !translate-y-0 !w-2 !h-2 !bg-sky-500 !border-sky-700"
                  style={{ position: "relative", left: 0, bottom: 0, transform: "none" }}
                />
              </div>
            );
          })}
        </div>
      ) : (
        // Standard single source handle at bottom
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-2 !h-2 !bg-zinc-500 !border-zinc-700"
        />
      )}
    </div>
  );
});
