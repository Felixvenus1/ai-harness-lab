import { useState, useEffect, useCallback, type JSX } from "react";
import type { Node, Edge } from "reactflow";
import { AppSidebar, type AppView } from "./components/AppSidebar";
import { TopBar } from "./components/TopBar";
import { SettingsPanel } from "./components/SettingsPanel";
import { HelpPanel } from "./components/HelpPanel";
import { Sidebar } from "./components/Sidebar";
import { CanvasShell } from "./components/CanvasShell";
import { InspectorPanel } from "./components/InspectorPanel";
import { ConnectorInspector } from "./components/ConnectorInspector";
import { ExecutionTracePanel } from "./components/ExecutionTraceDrawer";
import { EvaluationPage } from "./evaluation/index";
import { ObservabilityPage } from "./observability/index";
import { useFlowState } from "./hooks/useFlowState";
import { useExecutionTrace } from "./hooks/useExecutionTrace";
import { validateFlow, saveFlow } from "./services/apiClient";
import type { StarterFlow } from "./config/examples";
import type { HarnessNodeData } from "./nodes/HarnessNode";
import type { ConnectorConfig, FlowGraph } from "./types/flow";

type ValidateStatus = "idle" | "running" | "valid" | "invalid" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function App(): JSX.Element {
  const [view, setView] = useState<AppView>("canvas");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [density, setDensity] = useState<"compact" | "normal" | "comfortable">("normal");
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [validateStatus, setValidateStatus] = useState<ValidateStatus>("idle");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const flow = useFlowState();
  const exec = useExecutionTrace();

  useEffect(() => {
    document.body.classList.toggle("light-mode", theme === "light");
  }, [theme]);

  // Auto-reset transient badges after 3 s
  useEffect(() => {
    if (validateStatus === "valid" || validateStatus === "invalid" || validateStatus === "error") {
      const t = setTimeout(() => setValidateStatus("idle"), 3000);
      return () => clearTimeout(t);
    }
  }, [validateStatus]);

  useEffect(() => {
    if (saveStatus === "saved" || saveStatus === "error") {
      const t = setTimeout(() => setSaveStatus("idle"), 3000);
      return () => clearTimeout(t);
    }
  }, [saveStatus]);

  const selectedNode = (flow.nodes.find((n) => n.id === flow.selectedNodeId) ?? null) as
    | Node<HarnessNodeData>
    | null;
  const selectedEdge = (flow.edges.find((e) => e.id === flow.selectedEdgeId) ?? null) as
    | Edge<ConnectorConfig>
    | null;

  function handleNodeClick(id: string) {
    flow.setSelectedNodeId(id);
    flow.setSelectedEdgeId(null);
  }
  function handleEdgeClick(id: string) {
    flow.setSelectedEdgeId(id);
    flow.setSelectedNodeId(null);
  }
  function handlePaneClick() {
    flow.setSelectedNodeId(null);
    flow.setSelectedEdgeId(null);
  }

  function handleRun() {
    exec.run(flow.buildApiGraph());
  }

  const handleValidate = useCallback(async () => {
    setValidateStatus("running");
    try {
      const result = await validateFlow(flow.buildApiGraph());
      setValidateStatus(result.valid ? "valid" : "invalid");
    } catch {
      setValidateStatus("error");
    }
  }, [flow]);

  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    try {
      await saveFlow(flow.buildApiGraph(), flow.flowName);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }, [flow]);

  function handleLoadFlow(starter: StarterFlow) {
    flow.loadFlow(starter.rfNodes, starter.rfEdges, starter.name, starter.initial_input);
    exec.clear();
  }

  function handleLoadSavedFlow(graph: FlowGraph, name: string) {
    // Convert saved graph nodes/edges into ReactFlow format
    const rfNodes: Node[] = graph.nodes.map((n, idx) => ({
      id: n.id,
      type: "harnessNode",
      position: { x: 80, y: 40 + idx * 120 },
      data: { nodeType: n.type, config: n.config },
    }));
    const rfEdges: Edge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.source_handle ?? undefined,
      targetHandle: e.target_handle ?? undefined,
      type: "connectorEdge",
      data: e,
    }));
    flow.loadFlow(rfNodes, rfEdges, name, graph.initial_input);
    exec.clear();
  }

  const showTrace = exec.trace !== null || exec.status === "error";
  const showNodeInspector = selectedNode !== null && selectedEdge === null;
  const showEdgeInspector = selectedEdge !== null;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {showSettings && (
        <SettingsPanel theme={theme} onThemeChange={setTheme} onClose={() => setShowSettings(false)} />
      )}
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

      <AppSidebar
        view={view}
        onViewChange={setView}
        theme={theme}
        onThemeToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        onOpenSettings={() => setShowSettings(true)}
        onOpenHelp={() => setShowHelp(true)}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar
          flowName={flow.flowName}
          onFlowNameChange={flow.setFlowName}
          initialInput={flow.initialInput}
          onInitialInputChange={flow.setInitialInput}
          onRun={handleRun}
          onValidate={() => void handleValidate()}
          onSave={() => void handleSave()}
          runStatus={exec.status}
          validateStatus={validateStatus}
          saveStatus={saveStatus}
          density={density}
          onDensityChange={setDensity}
        />

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {view === "canvas" && (
            <>
              <Sidebar onLoadFlow={handleLoadFlow} onLoadSavedFlow={handleLoadSavedFlow} />
              <main style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                  <CanvasShell
                    nodes={flow.nodes}
                    edges={flow.edges}
                    onNodesChange={flow.onNodesChange}
                    onEdgesChange={flow.onEdgesChange}
                    onConnect={flow.onConnect}
                    onNodeClick={handleNodeClick}
                    onEdgeClick={handleEdgeClick}
                    onPaneClick={handlePaneClick}
                    addHarnessNode={flow.addHarnessNode}
                    density={density}
                  />

                  {showNodeInspector && (
                    <InspectorPanel
                      node={selectedNode!}
                      onUpdate={flow.updateNodeConfig}
                      onDelete={flow.deleteNode}
                      onClose={() => flow.setSelectedNodeId(null)}
                    />
                  )}
                  {showEdgeInspector && (
                    <ConnectorInspector
                      edge={selectedEdge!}
                      onUpdate={flow.updateEdgeData}
                      onDelete={(id) => { flow.deleteEdge(id); flow.setSelectedEdgeId(null); }}
                      onClose={() => flow.setSelectedEdgeId(null)}
                    />
                  )}
                </div>

                {showTrace && (
                  <ExecutionTracePanel
                    trace={exec.trace ?? { passed: false, final_output: null, results: [], total_duration_ms: 0 }}
                    error={exec.error}
                    onClose={exec.clear}
                  />
                )}
              </main>
            </>
          )}

          {view === "evaluation" && <EvaluationPage />}
          {view === "observability" && <ObservabilityPage />}
        </div>
      </div>
    </div>
  );
}
