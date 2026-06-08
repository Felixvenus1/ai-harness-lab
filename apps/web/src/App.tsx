// Purpose: Compose the full AI Harness Lab editor layout and wire all state together.

import type { JSX } from "react";
import type { Node } from "reactflow";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { CanvasShell } from "./components/CanvasShell";
import { InspectorPanel } from "./components/InspectorPanel";
import { ExecutionTracePanel } from "./components/ExecutionTraceDrawer";
import { useFlowState } from "./hooks/useFlowState";
import { useExecutionTrace } from "./hooks/useExecutionTrace";
import type { StarterFlow } from "./config/examples";
import type { HarnessNodeData } from "./nodes/HarnessNode";

export default function App(): JSX.Element {
  const flow = useFlowState();
  const exec = useExecutionTrace();

  const selectedNode = (flow.nodes.find((n) => n.id === flow.selectedNodeId) ?? null) as
    | Node<HarnessNodeData>
    | null;

  function handleRun() {
    exec.run(flow.buildApiGraph());
  }

  function handleLoadFlow(starter: StarterFlow) {
    flow.loadFlow(starter.rfNodes, starter.rfEdges, starter.name, starter.initial_input);
    exec.clear();
  }

  const showTrace = exec.trace !== null || exec.status === "error";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-950">
      <TopBar
        flowName={flow.flowName}
        onFlowNameChange={flow.setFlowName}
        initialInput={flow.initialInput}
        onInitialInputChange={flow.setInitialInput}
        onRun={handleRun}
        runStatus={exec.status}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar onLoadFlow={handleLoadFlow} />

        <main className="flex flex-col flex-1 overflow-hidden">
          {/* Canvas + inspector row */}
          <div className="flex flex-1 overflow-hidden">
            <CanvasShell
              nodes={flow.nodes}
              edges={flow.edges}
              onNodesChange={flow.onNodesChange}
              onEdgesChange={flow.onEdgesChange}
              onConnect={flow.onConnect}
              onNodeClick={(id) => flow.setSelectedNodeId(id)}
              onPaneClick={() => flow.setSelectedNodeId(null)}
              addHarnessNode={flow.addHarnessNode}
            />
            {selectedNode && (
              <InspectorPanel
                node={selectedNode}
                onUpdate={flow.updateNodeConfig}
                onDelete={flow.deleteNode}
                onClose={() => flow.setSelectedNodeId(null)}
              />
            )}
          </div>

          {/* Execution trace panel */}
          {showTrace && (
            <ExecutionTracePanel
              trace={
                exec.trace ?? {
                  passed: false,
                  final_output: null,
                  results: [],
                  total_duration_ms: 0,
                }
              }
              error={exec.error}
              onClose={exec.clear}
            />
          )}
        </main>
      </div>
    </div>
  );
}
