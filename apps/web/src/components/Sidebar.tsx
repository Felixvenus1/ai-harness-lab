// Purpose: Left sidebar combining the node palette and flows panel.

import type { JSX } from "react";
import { NodePalette } from "./NodePalette";
import { FlowsPanel } from "./FlowsPanel";
import type { StarterFlow } from "../config/examples";
import type { FlowGraph } from "../types/flow";

interface SidebarProps {
  onLoadFlow: (flow: StarterFlow) => void;
  onLoadSavedFlow: (graph: FlowGraph, name: string) => void;
}

export function Sidebar({ onLoadFlow, onLoadSavedFlow }: SidebarProps): JSX.Element {
  return (
    <aside
      style={{
        width: 224,
        flexShrink: 0,
        backgroundColor: "var(--bg-secondary)",
        borderRight: "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "12px 0",
        overflowY: "auto",
      }}
    >
      <NodePalette />
      <div style={{ height: 1, backgroundColor: "var(--border-color)", margin: "0 8px" }} />
      <FlowsPanel onLoad={onLoadFlow} onLoadSaved={onLoadSavedFlow} />
    </aside>
  );
}
