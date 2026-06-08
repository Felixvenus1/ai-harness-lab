// Purpose: Render a single generic canvas node for all harness node types.

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
  const { Icon } = meta;

  return (
    <div
      className={[
        "rounded-lg border px-3 py-2 min-w-[160px] shadow-lg select-none",
        meta.bgClass,
        meta.borderClass,
        selected ? "ring-2 ring-teal-400/60 ring-offset-1 ring-offset-zinc-950" : "",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-zinc-500 !border-zinc-700"
      />
      <div className="flex items-center gap-2">
        <Icon size={13} className={meta.iconColorClass} />
        <span className="text-xs font-semibold text-zinc-200">{meta.label}</span>
      </div>
      {data.config.label && (
        <p className="mt-0.5 text-[10px] text-zinc-500 truncate max-w-[150px]">
          {data.config.label}
        </p>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-zinc-500 !border-zinc-700"
      />
    </div>
  );
});
