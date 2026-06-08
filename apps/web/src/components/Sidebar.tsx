// Purpose: Render the left sidebar combining the node palette and starter flows panels.

import type { JSX } from "react";
import { NodePalette } from "./NodePalette";
import { FlowsPanel } from "./FlowsPanel";
import type { StarterFlow } from "../config/examples";

interface SidebarProps {
  onLoadFlow: (flow: StarterFlow) => void;
}

export function Sidebar({ onLoadFlow }: SidebarProps): JSX.Element {
  return (
    <aside className="w-56 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col gap-4 py-3 overflow-y-auto">
      <NodePalette />
      <div className="h-px bg-zinc-800 mx-2" />
      <FlowsPanel onLoad={onLoadFlow} />
    </aside>
  );
}
