// Purpose: Register node renderers and metadata for supported harness node types.
export type NodeRegistryEntry = {
  type: string;
  label: string;
};

export const nodeRegistry: NodeRegistryEntry[] = [];
