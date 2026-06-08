// Purpose: Declare TypeScript flow document stubs shared by web and api boundaries.
export type FlowSchemaDocument = {
  version: string;
  nodes: unknown[];
  edges: unknown[];
};
