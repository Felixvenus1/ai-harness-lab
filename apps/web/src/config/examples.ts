// Purpose: Define built-in starter flows available in the sidebar flows panel.

import type { Node, Edge } from "reactflow";
import type { NodeType, NodeConfig } from "../types/flow";
import { NODE_META } from "./nodeConfig";

export interface StarterFlow {
  id: string;
  name: string;
  description: string;
  initial_input: string;
  rfNodes: Node[];
  rfEdges: Edge[];
}

function n(
  id: string,
  nodeType: NodeType,
  config: NodeConfig,
  x: number,
  y: number,
): Node {
  return {
    id,
    type: "harnessNode",
    position: { x, y },
    data: { nodeType, config: { ...NODE_META[nodeType].defaultConfig, ...config } },
  };
}

function e(source: string, target: string): Edge {
  return { id: `${source}→${target}`, source, target };
}

export const STARTER_FLOWS: StarterFlow[] = [
  {
    id: "basic-chat",
    name: "Basic Chat",
    description: "Validate → normalise → model → log",
    initial_input: "Tell me a joke",
    rfNodes: [
      n("validator", "input_validator", { required: true, min_length: 3 }, 80, 40),
      n("normaliser", "normaliser", { strip: true, lowercase: false }, 80, 160),
      n("model", "model", { provider: "mock", response_mode: "valid_json" }, 80, 280),
      n("logger", "logger", { label: "Output" }, 80, 400),
    ],
    rfEdges: [e("validator", "normaliser"), e("normaliser", "model"), e("model", "logger")],
  },
  {
    id: "strict-schema",
    name: "Strict Schema",
    description: "Full pipeline with JSON schema validation",
    initial_input: "What is the answer to life?",
    rfNodes: [
      n("validator", "input_validator", { required: true }, 80, 40),
      n("normaliser", "normaliser", { strip: true }, 80, 160),
      n("model", "model", { provider: "mock", response_mode: "valid_json" }, 80, 280),
      n("schema_val", "schema_validator", { json_schema: { required: ["answer"] } }, 80, 400),
      n("logger", "logger", { label: "Output" }, 80, 520),
    ],
    rfEdges: [
      e("validator", "normaliser"),
      e("normaliser", "model"),
      e("model", "schema_val"),
      e("schema_val", "logger"),
    ],
  },
  {
    id: "fallback-chain",
    name: "Fallback Chain",
    description: "Model with safe fallback on failure",
    initial_input: "Summarise this article.",
    rfNodes: [
      n("validator", "input_validator", { required: true }, 80, 40),
      n("model", "model", { provider: "mock", response_mode: "timeout" }, 80, 160),
      n("schema_val", "schema_validator", { json_schema: { required: ["answer"] } }, 80, 280),
      n("fallback", "fallback", { fallback_response: "Service temporarily unavailable." }, 80, 400),
      n("logger", "logger", { label: "Output" }, 80, 520),
    ],
    rfEdges: [
      e("validator", "model"),
      e("model", "schema_val"),
      e("schema_val", "fallback"),
      e("fallback", "logger"),
    ],
  },
  {
    id: "logging-heavy",
    name: "Logging Heavy",
    description: "Extensive logging at every stage",
    initial_input: "Explain quantum entanglement.",
    rfNodes: [
      n("validator", "input_validator", { required: true }, 80, 40),
      n("log1", "logger", { label: "Pre-normalise" }, 80, 160),
      n("normaliser", "normaliser", { strip: true, template: "User asked: {input}" }, 80, 280),
      n("log2", "logger", { label: "Pre-model" }, 80, 400),
      n("model", "model", { provider: "mock", response_mode: "valid_json" }, 80, 520),
      n("log3", "logger", { label: "Output" }, 80, 640),
    ],
    rfEdges: [
      e("validator", "log1"),
      e("log1", "normaliser"),
      e("normaliser", "log2"),
      e("log2", "model"),
      e("model", "log3"),
    ],
  },
];
