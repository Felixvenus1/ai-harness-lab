// Purpose: Define TypeScript types for API execution trace responses.

export interface ExecutionResult {
  node_id: string;
  node_type: string;
  input: unknown;
  output: unknown;
  passed: boolean;
  error: string | null;
  duration_ms: number;
}

export interface ExecutionTrace {
  passed: boolean;
  final_output: unknown;
  results: ExecutionResult[];
  total_duration_ms: number;
}
