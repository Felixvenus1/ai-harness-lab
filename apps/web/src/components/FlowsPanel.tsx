// Purpose: Render the list of starter flows that users can click to load onto the canvas.

import type { JSX } from "react";
import { FolderOpen } from "lucide-react";
import { STARTER_FLOWS } from "../config/examples";
import type { StarterFlow } from "../config/examples";

interface FlowsPanelProps {
  onLoad: (flow: StarterFlow) => void;
}

export function FlowsPanel({ onLoad }: FlowsPanelProps): JSX.Element {
  return (
    <div className="px-2">
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
            <FolderOpen size={11} className="text-teal-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-zinc-200 font-medium truncate">{flow.name}</p>
              <p className="text-[10px] text-zinc-500 truncate leading-tight mt-0.5">
                {flow.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
