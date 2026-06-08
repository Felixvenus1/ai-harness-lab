// Purpose: Declare provider interface stubs for mock and external model providers.
export interface ProviderContract {
  name: string;
  complete: () => Promise<string>;
}
