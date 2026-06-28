// Purpose: Define TypeScript types for flow graphs matching the Python core schemas exactly.

export type NodeType =
  | "input_validator"
  | "normaliser"
  | "model"
  | "schema_validator"
  | "fallback"
  | "logger"
  | "router"
  | "merge"
  | "loop";

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
  model?: string;
  system_prompt?: string;
  response_mode?: string;
  // schema_validator
  json_schema?: Record<string, unknown>;
  // fallback
  fallback_response?: string;
  // logger
  label?: string;
  // router: [{ source_handle, expression, label? }]
  routes?: Array<{ source_handle: string; expression: string; label?: string }>;
  // merge
  merge_strategy?: "first_wins" | "all_required";
  // loop
  max_iterations?: number;
  exit_condition?: string;
  loop_target?: string;
}

/** Node as sent to the API — no canvas position. */
export interface ApiNode {
  id: string;
  type: NodeType;
  config: NodeConfig;
}

// ---------------------------------------------------------------------------
// Connector — first-class directed edge with runtime policy
// ---------------------------------------------------------------------------

export interface ConnectorPolicy {
  routing_rule: "always" | "on_success" | "on_failure" | "on_condition";
  condition?: string;
  retry_limit?: number;
  retry_delay_ms?: number;
  timeout_ms?: number;
  cost_limit_usd?: number;
  log_on_traverse?: boolean;
}

export interface ConnectorConfig {
  id: string;
  source: string;
  target: string;
  source_handle?: string;
  target_handle?: string;
  label?: string;
  policy: ConnectorPolicy;
  metadata?: Record<string, unknown>;
}

/** Complete flow graph payload for POST /run. */
export interface FlowGraph {
  id?: string;
  name?: string;
  initial_input: string;
  nodes: ApiNode[];
  edges: ConnectorConfig[];
}
