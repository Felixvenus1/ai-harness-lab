// Purpose: Render draggable node type tiles that users drop onto the canvas.

import type { JSX } from "react";
import { NODE_META, NODE_TYPES_ORDERED } from "../config/nodeConfig";
import type { NodeType } from "../types/flow";

export function NodePalette(): JSX.Element {
  function onDragStart(e: React.DragEvent, nodeType: NodeType) {
    e.dataTransfer.setData("nodeType", nodeType);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div className="px-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-1 pb-1.5">
        Nodes
      </p>
      <div className="flex flex-col gap-1">
        {NODE_TYPES_ORDERED.map((type) => {
          const meta = NODE_META[type];
          const { Icon } = meta;
          return (
            <div
              key={type}
              draggable
              onDragStart={(e) => onDragStart(e, type)}
              className={[
                "flex items-center gap-2 px-2 py-1.5 rounded border cursor-grab active:cursor-grabbing select-none",
                meta.bgClass,
                meta.borderClass,
                "hover:brightness-110 transition-all",
              ].join(" ")}
            >
              <Icon size={12} className={meta.iconColorClass} />
              <span className="text-xs text-zinc-300">{meta.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
