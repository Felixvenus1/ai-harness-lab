// Purpose: Declare execution request and result stubs shared across applications.
export type ExecutionRequest = {
  flow: unknown;
  input: unknown;
};

export type ExecutionResult = {
  status: string;
};
