// Purpose: Manage ReactFlow canvas state with localStorage persistence and flow operations.

import { useState, useEffect, useCallback } from "react";
import { useNodesState, useEdgesState } from "reactflow";
import type { Node, Edge, Connection } from "reactflow";
import type { NodeType, NodeConfig, FlowGraph, ConnectorConfig } from "../types/flow";

const STORAGE_KEY = "aiharness:flow";

interface PersistedState {
  nodes: Node[];
  edges: Edge[];
  initialInput: string;
  flowName: string;
}

/** Coerce any edge (old bare {source,target} format or new ConnectorConfig) into a typed edge. */
function normalizeEdge(edge: Edge): Edge<ConnectorConfig> {
  const id = edge.id || `${edge.source}→${edge.target}`;
  return {
    ...edge,
    id,
    type: "connectorEdge",
    data: edge.data ?? {
      id,
      source: edge.source,
      target: edge.target,
      source_handle: edge.sourceHandle ?? undefined,
      target_handle: edge.targetHandle ?? undefined,
      policy: { routing_rule: "always" },
      metadata: {},
    },
  };
}

function loadFromStorage(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    // Normalize edges so old saved flows get ConnectorConfig data.
    if (parsed.edges) {
      parsed.edges = parsed.edges.map(normalizeEdge);
    }
    return parsed;
  } catch {
    return {};
  }
}

export function useFlowState() {
  const saved = loadFromStorage();
  const [nodes, setNodes, onNodesChange] = useNodesState(saved.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(saved.edges ?? []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [initialInput, setInitialInput] = useState(saved.initialInput ?? "");
  const [flowName, setFlowName] = useState(saved.flowName ?? "Untitled Flow");

  // Persist to localStorage whenever state changes.
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ nodes, edges, initialInput, flowName }),
    );
  }, [nodes, edges, initialInput, flowName]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const newId = crypto.randomUUID();
      const newEdge: Edge<ConnectorConfig> = {
        id: newId,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        type: "connectorEdge",
        data: {
          id: newId,
          source: connection.source!,
          target: connection.target!,
          source_handle: connection.sourceHandle ?? undefined,
          target_handle: connection.targetHandle ?? undefined,
          policy: { routing_rule: "always" },
          metadata: {},
        },
      };
      setEdges((eds) => [...eds, newEdge]);
    },
    [setEdges],
  );

  const updateNodeConfig = useCallback(
    (id: string, config: NodeConfig) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, config } } : n)),
      );
    },
    [setNodes],
  );

  const updateEdgeData = useCallback(
    (edgeId: string, patch: Partial<ConnectorConfig>) => {
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== edgeId) return e;
          const merged: ConnectorConfig = { ...e.data, ...patch } as ConnectorConfig;
          return { ...e, data: merged };
        }),
      );
    },
    [setEdges],
  );

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedNodeId((prev) => (prev === id ? null : prev));
    },
    [setNodes, setEdges],
  );

  const deleteEdge = useCallback(
    (id: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== id));
      setSelectedEdgeId((prev) => (prev === id ? null : prev));
    },
    [setEdges],
  );

  const addHarnessNode = useCallback(
    (nodeType: NodeType, config: NodeConfig, position: { x: number; y: number }) => {
      const newNode: Node = {
        id: crypto.randomUUID(),
        type: "harnessNode",
        position,
        data: { nodeType, config: { ...config } },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes],
  );

  const loadFlow = useCallback(
    (rfNodes: Node[], rfEdges: Edge[], name: string, input: string) => {
      setNodes(structuredClone(rfNodes));
      setEdges(structuredClone(rfEdges).map(normalizeEdge));
      setFlowName(name);
      setInitialInput(input);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    },
    [setNodes, setEdges],
  );

  const buildApiGraph = useCallback(
    (): FlowGraph => ({
      name: flowName,
      initial_input: initialInput,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.data.nodeType as NodeType,
        config: n.data.config as NodeConfig,
      })),
      edges: edges.map((e) => {
        const d = e.data as ConnectorConfig | undefined;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          source_handle: e.sourceHandle ?? d?.source_handle ?? undefined,
          target_handle: e.targetHandle ?? d?.target_handle ?? undefined,
          label: d?.label,
          policy: d?.policy ?? { routing_rule: "always" },
          metadata: d?.metadata ?? {},
        };
      }),
    }),
    [nodes, edges, flowName, initialInput],
  );

  return {
    nodes,
    setNodes,
    onNodesChange,
    edges,
    onEdgesChange,
    onConnect,
    selectedNodeId,
    setSelectedNodeId,
    selectedEdgeId,
    setSelectedEdgeId,
    initialInput,
    setInitialInput,
    flowName,
    setFlowName,
    updateNodeConfig,
    updateEdgeData,
    deleteNode,
    deleteEdge,
    addHarnessNode,
    loadFlow,
    buildApiGraph,
  };
}
