// Purpose: Manage ReactFlow canvas state with localStorage persistence and flow operations.

import { useState, useEffect, useCallback } from "react";
import { useNodesState, useEdgesState, addEdge } from "reactflow";
import type { Node, Edge, Connection } from "reactflow";
import type { NodeType, NodeConfig, FlowGraph } from "../types/flow";

const STORAGE_KEY = "aiharness:flow";

interface PersistedState {
  nodes: Node[];
  edges: Edge[];
  initialInput: string;
  flowName: string;
}

function loadFromStorage(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PersistedState>) : {};
  } catch {
    return {};
  }
}

export function useFlowState() {
  const saved = loadFromStorage();
  const [nodes, setNodes, onNodesChange] = useNodesState(saved.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(saved.edges ?? []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
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
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
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

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedNodeId((prev) => (prev === id ? null : prev));
    },
    [setNodes, setEdges],
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
      setEdges(structuredClone(rfEdges));
      setFlowName(name);
      setInitialInput(input);
      setSelectedNodeId(null);
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
      edges: edges.map((e) => ({ source: e.source, target: e.target })),
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
    initialInput,
    setInitialInput,
    flowName,
    setFlowName,
    updateNodeConfig,
    deleteNode,
    addHarnessNode,
    loadFlow,
    buildApiGraph,
  };
}
