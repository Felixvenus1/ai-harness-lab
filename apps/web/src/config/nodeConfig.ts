// Purpose: Define per-node-type visual metadata, default configs, and inspector field definitions.

import type { LucideIcon } from "lucide-react";
import {
  ShieldCheck,
  Filter,
  BrainCircuit,
  CheckSquare2,
  LifeBuoy,
  ScrollText,
} from "lucide-react";
import type { NodeType, NodeConfig } from "../types/flow";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "textarea";
  options?: string[];
  placeholder?: string;
}

export interface NodeMeta {
  label: string;
  borderClass: string;
  bgClass: string;
  iconColorClass: string;
  Icon: LucideIcon;
  defaultConfig: NodeConfig;
  fields: FieldDef[];
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
};

export const NODE_TYPES_ORDERED: NodeType[] = [
  "input_validator",
  "normaliser",
  "model",
  "schema_validator",
  "fallback",
  "logger",
];
