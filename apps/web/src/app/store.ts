// Purpose: Expose an application state container stub for global editor state.
export type AppStore = {
  ready: boolean;
};

export function createStore(): AppStore {
  return { ready: false };
}
