// Purpose: Define TypeScript types for flow graphs matching the Python core schemas exactly.

export type NodeType =
  | "input_validator"
  | "normaliser"
  | "model"
  | "schema_validator"
  | "fallback"
  | "logger";

export interface NodeConfig {
  // input_validator
  required?: boolean;
  min_length?: number;
  max_length?: number;
  // normaliser
  strip?: boolean;
  lowercase?: boolean;
  template?: string;
  // model
  provider?: string;
  system_prompt?: string;
  response_mode?: string;
  // schema_validator
  json_schema?: Record<string, unknown>;
  // fallback
  fallback_response?: string;
  // logger
  label?: string;
}

/** Node as sent to the API — no canvas position. */
export interface ApiNode {
  id: string;
  type: NodeType;
  config: NodeConfig;
}

/** Edge as sent to the API. */
export interface ApiEdge {
  source: string;
  target: string;
}

/** Complete flow graph payload for POST /run. */
export interface FlowGraph {
  id?: string;
  name?: string;
  initial_input: string;
  nodes: ApiNode[];
  edges: ApiEdge[];
}
