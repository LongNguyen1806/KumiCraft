// Graceful shutdown handler for the CLI on SIGINT and SIGTERM (R-CL-02).

export type ShutdownDeps = {
  readonly close: () => Promise<void>;
  readonly exit: (code: number) => void;
  readonly log: (line: string) => void;
  readonly warn: (line: string) => void;
  readonly setTimer?: typeof setTimeout;
  readonly clearTimer?: typeof clearTimeout;
};

export const SHUTDOWN_TIMEOUT_MS = 10_000;

export function createShutdown(deps: ShutdownDeps): () => Promise<void> {
  const setTimer = deps.setTimer ?? setTimeout;
  const clearTimer = deps.clearTimer ?? clearTimeout;
  let stopping = false;
  let timedOut = false;
  let activeTimer: ReturnType<typeof setTimeout> | undefined;

  return async () => {
    if (stopping) {
      if (activeTimer !== undefined) {
        clearTimer(activeTimer);
        activeTimer = undefined;
      }
      deps.log('Forced stop.');
      deps.exit(1);
      return;
    }

    stopping = true;
    deps.log('Stopping KumiCraft…');
    const timer = setTimer(() => {
      timedOut = true;
      activeTimer = undefined;
      deps.warn('kumicraft: shutdown timed out after 10s; forcing exit.');
      deps.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    activeTimer = timer;

    try {
      await deps.close();
    } catch (error) {
      deps.warn(`kumicraft: error while stopping (${String(error)})`);
    }

    if (!timedOut) {
      clearTimer(timer);
      activeTimer = undefined;
      deps.exit(0);
    }
  };
}
