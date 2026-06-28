// Purpose: Define per-node-type visual metadata, default configs, and inspector field definitions.

import type { LucideIcon } from "lucide-react";
import {
  ShieldCheck,
  Filter,
  BrainCircuit,
  CheckSquare2,
  LifeBuoy,
  ScrollText,
  GitBranch,
  GitMerge,
  RefreshCw,
} from "lucide-react";
import type { NodeType, NodeConfig } from "../types/flow";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "textarea";
  options?: string[];
  placeholder?: string;
}

/** Named output handle definition for nodes that branch (e.g. router). */
export interface OutputHandle {
  id: string;     // matches source_handle on ConnectorConfig
  label: string;  // shown as sublabel on the handle
}

export interface NodeMeta {
  label: string;
  borderClass: string;
  bgClass: string;
  iconColorClass: string;
  Icon: LucideIcon;
  defaultConfig: NodeConfig;
  fields: FieldDef[];
  /** Optional named output handles. Undefined = single unnamed source handle at bottom. */
  outputHandles?: OutputHandle[];
}

export const NODE_META: Record<NodeType, NodeMeta> = {
  input_validator: {
    label: "Input Validator",
    borderClass: "border-blue-500/60",
    bgClass: "bg-blue-950/50",
    iconColorClass: "text-blue-400",
    Icon: ShieldCheck,
    defaultConfig: { required: true },
    fields: [
      { key: "required", label: "Required", type: "boolean" },
      { key: "min_length", label: "Min Length", type: "number", placeholder: "none" },
      { key: "max_length", label: "Max Length", type: "number", placeholder: "none" },
    ],
  },
  normaliser: {
    label: "Normaliser",
    borderClass: "border-violet-500/60",
    bgClass: "bg-violet-950/50",
    iconColorClass: "text-violet-400",
    Icon: Filter,
    defaultConfig: { strip: true, lowercase: false },
    fields: [
      { key: "strip", label: "Strip whitespace", type: "boolean" },
      { key: "lowercase", label: "Lowercase", type: "boolean" },
      { key: "template", label: "Template", type: "textarea", placeholder: "Prompt: {input}" },
    ],
  },
  model: {
    label: "Model",
    borderClass: "border-teal-500/60",
    bgClass: "bg-teal-950/50",
    iconColorClass: "text-teal-400",
    Icon: BrainCircuit,
    defaultConfig: { provider: "mock", response_mode: "valid_json" },
    fields: [
      {
        key: "provider",
        label: "Provider",
        type: "select",
        options: ["mock", "openrouter", "gemini"],
      },
      {
        key: "response_mode",
        label: "Response Mode",
        type: "select",
        options: ["valid_json", "malformed_json", "timeout", "unsafe", "echo"],
      },
      {
        key: "model",
        label: "Model ID",
        type: "text",
        placeholder: "claude-haiku-4-5-20251001",
      },
      {
        key: "system_prompt",
        label: "System Prompt",
        type: "textarea",
        placeholder: "You are a helpful assistant.",
      },
    ],
  },
  schema_validator: {
    label: "Schema Validator",
    borderClass: "border-amber-500/60",
    bgClass: "bg-amber-950/50",
    iconColorClass: "text-amber-400",
    Icon: CheckSquare2,
    defaultConfig: {},
    fields: [
      {
        key: "json_schema",
        label: "JSON Schema",
        type: "textarea",
        placeholder: '{\n  "required": ["answer"]\n}',
      },
    ],
  },
  fallback: {
    label: "Fallback",
    borderClass: "border-orange-500/60",
    bgClass: "bg-orange-950/50",
    iconColorClass: "text-orange-400",
    Icon: LifeBuoy,
    defaultConfig: { fallback_response: "I could not process that request." },
    fields: [
      {
        key: "fallback_response",
        label: "Fallback Response",
        type: "textarea",
        placeholder: "Safe default response",
      },
    ],
  },
  logger: {
    label: "Logger",
    borderClass: "border-zinc-500/60",
    bgClass: "bg-zinc-800/50",
    iconColorClass: "text-zinc-400",
    Icon: ScrollText,
    defaultConfig: { label: "Log" },
    fields: [{ key: "label", label: "Label", type: "text", placeholder: "Log" }],
  },
  router: {
    label: "Router",
    borderClass: "border-sky-500/60",
    bgClass: "bg-sky-950/50",
    iconColorClass: "text-sky-400",
    Icon: GitBranch,
    defaultConfig: {
      routes: [
        { source_handle: "on_success", expression: "passed == True", label: "Success" },
        { source_handle: "on_failure", expression: "passed == False", label: "Failure" },
      ],
    },
    fields: [
      {
        key: "routes",
        label: "Routes (JSON)",
        type: "textarea",
        placeholder: '[{"source_handle":"on_success","expression":"passed == True"}]',
      },
    ],
    outputHandles: [
      { id: "on_success", label: "Success" },
      { id: "default",    label: "Default" },
      { id: "on_failure", label: "Failure" },
    ],
  },
  merge: {
    label: "Merge",
    borderClass: "border-pink-500/60",
    bgClass: "bg-pink-950/50",
    iconColorClass: "text-pink-400",
    Icon: GitMerge,
    defaultConfig: { merge_strategy: "first_wins" },
    fields: [
      {
        key: "merge_strategy",
        label: "Strategy",
        type: "select",
        options: ["first_wins", "all_required"],
      },
    ],
  },
  loop: {
    label: "Loop",
    borderClass: "border-lime-500/60",
    bgClass: "bg-lime-950/50",
    iconColorClass: "text-lime-400",
    Icon: RefreshCw,
    defaultConfig: { max_iterations: 3 },
    fields: [
      { key: "max_iterations", label: "Max Iterations", type: "number", placeholder: "3" },
      {
        key: "exit_condition",
        label: "Exit Condition",
        type: "text",
        placeholder: "passed == True",
      },
      {
        key: "loop_target",
        label: "Loop Target Node ID",
        type: "text",
        placeholder: "node-id-to-retry",
      },
    ],
  },
};

export const NODE_TYPES_ORDERED: NodeType[] = [
  "input_validator",
  "normaliser",
  "model",
  "schema_validator",
  "fallback",
  "logger",
  "router",
  "merge",
  "loop",
];

/** Minimap hex colours per node type. */
export const NODE_MINIMAP_COLORS: Record<NodeType, string> = {
  input_validator: "#1d4ed8",
  normaliser:      "#7c3aed",
  model:           "#0d9488",
  schema_validator:"#b45309",
  fallback:        "#c2410c",
  logger:          "#52525b",
  router:          "#0369a1",
  merge:           "#9d174d",
  loop:            "#3f6212",
};
