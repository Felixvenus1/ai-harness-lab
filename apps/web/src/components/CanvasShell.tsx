// Purpose: Provide the ReactFlow canvas with drag-drop, node interaction, and dark styling.

import { useRef, useCallback, type JSX } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  type ReactFlowInstance,
} from "reactflow";
import { HarnessNode } from "../nodes/HarnessNode";
import { NODE_META } from "../config/nodeConfig";
import type { NodeType, NodeConfig } from "../types/flow";

// Defined outside the component so React Flow doesn't recreate it on each render.
const NODE_TYPES = { harnessNode: HarnessNode };

// Hex colours per node type for the minimap.
const NODE_COLORS: Record<NodeType, string> = {
  input_validator: "#1d4ed8",
  normaliser: "#7c3aed",
  model: "#0d9488",
  schema_validator: "#b45309",
  fallback: "#c2410c",
  logger: "#52525b",
};

interface CanvasShellProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onNodeClick: (nodeId: string) => void;
  onPaneClick: () => void;
  addHarnessNode: (type: NodeType, config: NodeConfig, pos: { x: number; y: number }) => void;
}

export function CanvasShell({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
  addHarnessNode,
}: CanvasShellProps): JSX.Element {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData("nodeType") as NodeType;
      if (!nodeType || !rfInstanceRef.current || !wrapperRef.current) return;
      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = rfInstanceRef.current.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      addHarnessNode(nodeType, { ...NODE_META[nodeType].defaultConfig }, position);
    },
    [addHarnessNode],
  );

  return (
    <div
      ref={wrapperRef}
      className="flex-1 h-full"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick(node.id)}
        onPaneClick={onPaneClick}
        onInit={(instance) => {
          rfInstanceRef.current = instance;
        }}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        deleteKeyCode="Delete"
        proOptions={{ hideAttribution: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#27272a"
        />
        <Controls />
        <MiniMap
          nodeColor={(n) => NODE_COLORS[n.data?.nodeType as NodeType] ?? "#3f3f46"}
          maskColor="rgba(9,9,11,0.75)"
        />
      </ReactFlow>
    </div>
  );
}
