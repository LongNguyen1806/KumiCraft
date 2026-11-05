// Intercepts the application's first net.Server.listen call to bind on ephemeral port 0 (SPEC-04 M-RN, Phase 4 K4).
import net from 'node:net';

export type ListenHook = {
  readonly portPromise: Promise<number>;
  readonly dispose: () => void;
};

type HookState = {
  resolved: boolean;
  timer?: NodeJS.Timeout | undefined;
  resolvePort: (port: number) => void;
  rejectPort: (err: Error) => void;
};

function extractPort(server: net.Server): number | undefined {
  const addr = server.address();
  if (addr && typeof addr === 'object' && 'port' in addr && typeof addr.port === 'number') {
    return addr.port;
  }
  return undefined;
}

function attachServerListeners(
  server: net.Server,
  state: HookState,
  cleanupTimer: () => void,
): void {
  server.once('listening', () => {
    if (state.resolved) return;
    state.resolved = true;
    cleanupTimer();
    const port = extractPort(server);
    if (port !== undefined) {
      process.env.PORT = String(port);
      state.resolvePort(port);
    } else {
      state.rejectPort(new Error('noListen'));
    }
  });

  server.once('error', (err) => {
    if (state.resolved) return;
    state.resolved = true;
    cleanupTimer();
    state.rejectPort(err instanceof Error ? err : new Error(String(err)));
  });
}

function findCallback(args: readonly unknown[]): (() => void) | undefined {
  for (let i = args.length - 1; i >= 0; i -= 1) {
    const item = args[i];
    if (typeof item === 'function') {
      return item as () => void;
    }
  }
  return undefined;
}

type OriginalListen = (this: net.Server, opts: net.ListenOptions, cb?: () => void) => net.Server;

function isListenFunction(fn: unknown): fn is OriginalListen {
  return typeof fn === 'function';
}

function delegateListen(
  server: net.Server,
  originalListen: OriginalListen,
  args: readonly unknown[],
): net.Server {
  const firstArg = args[0];
  const baseOpts: Record<string, unknown> =
    Boolean(firstArg) && typeof firstArg === 'object' ? (firstArg as Record<string, unknown>) : {};
  const opts: net.ListenOptions = {
    ...baseOpts,
    port: 0,
    host: '127.0.0.1',
  };
  const cb = findCallback(args);
  if (cb !== undefined) {
    return originalListen.call(server, opts, cb);
  }
  return originalListen.call(server, opts);
}

function createPortPromise(state: HookState): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    state.resolvePort = resolve;
    state.rejectPort = reject;
  });
}

export function installListenHook(timeoutMs = 20_000): ListenHook {
  const serverProto: { listen?: unknown } = net.Server.prototype;
  const rawListen = serverProto.listen;
  if (!isListenFunction(rawListen)) {
    throw new Error('net.Server.prototype.listen is not a function');
  }
  const originalListen = rawListen;
  const restoreListen = () => {
    serverProto.listen = originalListen;
  };

  const state: HookState = {
    resolved: false,
    resolvePort: () => {},
    rejectPort: () => {},
  };

  const portPromise = createPortPromise(state);

  const cleanupTimer = () => {
    if (state.timer !== undefined) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }
  };

  state.timer = setTimeout(() => {
    if (!state.resolved) {
      state.resolved = true;
      cleanupTimer();
      restoreListen();
      state.rejectPort(new Error('noListen'));
    }
  }, timeoutMs);

  serverProto.listen = function (this: net.Server, ...args: unknown[]): net.Server {
    restoreListen();
    attachServerListeners(this, state, cleanupTimer);
    return delegateListen(this, originalListen, args);
  };

  return {
    portPromise,
    dispose: () => {
      cleanupTimer();
      restoreListen();
    },
  };
}
