// Purpose: Provide stable ID generation for nodes, edges, and runs.
export function createId(): string {
  return crypto.randomUUID();
}
