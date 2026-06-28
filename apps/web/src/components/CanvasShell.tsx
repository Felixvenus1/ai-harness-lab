// Purpose: Provide the ReactFlow canvas with drag-drop, node/edge interaction, and dark styling.

import { useRef, useCallback, type JSX } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  MarkerType,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  type ReactFlowInstance,
} from "reactflow";
import { HarnessNode } from "../nodes/HarnessNode";
import { ConnectorEdge } from "./ConnectorEdge";
import { NODE_META, NODE_MINIMAP_COLORS } from "../config/nodeConfig";
import type { NodeType, NodeConfig } from "../types/flow";

// Defined outside the component so React Flow doesn't recreate them on each render.
const NODE_TYPES = { harnessNode: HarnessNode };
const EDGE_TYPES = { connectorEdge: ConnectorEdge };

const DEFAULT_EDGE_OPTIONS = {
  type: "connectorEdge",
  markerEnd: { type: MarkerType.ArrowClosed, color: "#52525b", width: 14, height: 14 },
};

interface CanvasShellProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onNodeClick: (nodeId: string) => void;
  onEdgeClick: (edgeId: string) => void;
  onPaneClick: () => void;
  addHarnessNode: (type: NodeType, config: NodeConfig, pos: { x: number; y: number }) => void;
  density?: "compact" | "normal" | "comfortable";
}

export function CanvasShell({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
  addHarnessNode,
  density = "normal",
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
      className={`flex-1 h-full density-${density}`}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick(node.id)}
        onEdgeClick={(_, edge) => onEdgeClick(edge.id)}
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
          size={1.2}
          color="var(--border-color)"
        />
        <Controls />
        <MiniMap
          nodeColor={(n) => NODE_MINIMAP_COLORS[n.data?.nodeType as NodeType] ?? "#3f3f46"}
          maskColor="rgba(9,9,11,0.75)"
        />
      </ReactFlow>
    </div>
  );
}
