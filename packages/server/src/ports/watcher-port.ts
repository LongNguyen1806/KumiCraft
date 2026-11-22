// WatcherPort (ADR-BE-20): the only way core learns that files of the project changed.
export type WatchHandle = {
  close(): Promise<void>;
};

export type WatcherPort = {
  /**
   * Watches the project folder (without node_modules, .git, dist). Calls onBatch with the paths
   * that changed, relative to root with '/' separators, gathered over 300 ms.
   */
  watch(root: string, onBatch: (files: readonly string[]) => void): WatchHandle;
};
