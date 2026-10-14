// WebSocket client for real-time server events (SPEC-03 section 6, SPEC-05 section 3).
import { readSessionToken } from './session-token.ts';

/** Event types of SPEC-03 section 6. Each module parses the payload of its own events. */
export type ServerEventType =
  | 'session.changed'
  | 'project.changed'
  | 'project.filesChanged'
  | 'runner.status'
  | 'runner.log'
  | 'history.changed'
  | 'settings.changed'
  | 'job.progress'
  | 'job.completed'
  | 'job.failed'
  | 'job.cancelled'
  | 'server.shuttingDown';

export type StudioServerEvent = {
  readonly v: 1;
  readonly type: ServerEventType;
  readonly at: string;
  readonly correlationId?: string;
  readonly payload: unknown;
};

export type EventsClientOptions = {
  readonly url?: string;
  readonly onConnectionChange?: (connected: boolean) => void;
  readonly onEvent?: (event: StudioServerEvent) => void;
};

export type EventsClient = {
  close(): void;
  readonly isConnected: () => boolean;
};

function defaultWsUrl(): string {
  const loc = window.location;
  const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${loc.host}/api/v1/events`;
}

function parseEventFrame(raw: unknown): StudioServerEvent | undefined {
  try {
    return JSON.parse(String(raw)) as StudioServerEvent;
  } catch {
    return undefined;
  }
}

function bindSocketListeners(
  socket: WebSocket,
  callbacks: {
    readonly onOpen: () => void;
    readonly onMessage: (event: StudioServerEvent) => void;
    readonly onClose: () => void;
  },
): void {
  socket.onopen = callbacks.onOpen;
  socket.onmessage = (event: MessageEvent) => {
    const parsed = parseEventFrame(event.data);
    if (parsed !== undefined) {
      callbacks.onMessage(parsed);
    }
  };
  socket.onclose = callbacks.onClose;
  socket.onerror = () => {
    socket.close();
  };
}

function tryOpenSocket(
  options: EventsClientOptions | undefined,
  callbacks: { readonly onOpen: () => void; readonly onClose: () => void },
): WebSocket | undefined {
  const token = readSessionToken();
  if (token === undefined) {
    options?.onConnectionChange?.(false);
    return undefined;
  }
  try {
    const ws = new WebSocket(options?.url ?? defaultWsUrl(), [
      `reactcraft.token.${token}`,
      'reactcraft.v1',
    ]);
    bindSocketListeners(ws, {
      onOpen: callbacks.onOpen,
      onMessage: (ev) => options?.onEvent?.(ev),
      onClose: callbacks.onClose,
    });
    return ws;
  } catch {
    return undefined;
  }
}

export function createEventsClient(options?: EventsClientOptions): EventsClient {
  let ws: WebSocket | undefined;
  let closed = false;
  let connected = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = 1000;

  function scheduleReconnect(): void {
    if (closed || reconnectTimer !== undefined) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      retryDelay = Math.min(retryDelay * 1.5, 10000);
      connect();
    }, retryDelay);
  }

  function connect(): void {
    if (closed) return;
    ws = tryOpenSocket(options, {
      onOpen: () => {
        connected = true;
        retryDelay = 1000;
        options?.onConnectionChange?.(true);
      },
      onClose: () => {
        if (connected) {
          connected = false;
          options?.onConnectionChange?.(false);
        }
        scheduleReconnect();
      },
    });
    if (ws === undefined && readSessionToken() !== undefined) {
      scheduleReconnect();
    }
  }

  connect();

  return {
    close(): void {
      closed = true;
      if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
      if (ws !== undefined) {
        ws.onclose = () => {};
        ws.close();
      }
      connected = false;
    },
    isConnected: () => connected,
  };
}
