// WebSocket client for real-time server events (SPEC-03 section 6, SPEC-05 section 3).
import {
  type ServerEventType,
  type StudioServerEvent,
  StudioServerEventSchema,
} from '@reactcraft/shared';

import { readSessionToken } from './session-token.ts';

export type { ServerEventType, StudioServerEvent };

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
    const parsed = StudioServerEventSchema.safeParse(JSON.parse(String(raw)));
    return parsed.success ? parsed.data : undefined;
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

type Subscriber = {
  readonly onConnectionChange?: ((connected: boolean) => void) | undefined;
  readonly onEvent?: ((event: StudioServerEvent) => void) | undefined;
};

/**
 * One WebSocket per URL for the whole tab, shared by every subscriber. A socket still connecting is
 * never closed (browsers report "closed before the connection is established"): when the last
 * subscriber leaves meanwhile, it closes once open, unless someone subscribes again first, as React
 * StrictMode does when it runs every effect twice.
 */
type SharedConnection = {
  readonly url: string;
  readonly subscribers: Set<Subscriber>;
  ws: WebSocket | undefined;
  connected: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  retryDelay: number;
};

/** `WebSocket.CONNECTING` (WHATWG): the socket has not opened yet. */
const SOCKET_CONNECTING = 0;

const connections = new Map<string, SharedConnection>();

function notify(conn: SharedConnection, connected: boolean): void {
  for (const sub of conn.subscribers) sub.onConnectionChange?.(connected);
}

function scheduleReconnect(conn: SharedConnection): void {
  if (conn.subscribers.size === 0 || conn.reconnectTimer !== undefined) return;
  conn.reconnectTimer = setTimeout(() => {
    conn.reconnectTimer = undefined;
    conn.retryDelay = Math.min(conn.retryDelay * 1.5, 10000);
    connect(conn);
  }, conn.retryDelay);
}

function connect(conn: SharedConnection): void {
  if (conn.subscribers.size === 0) return;
  conn.ws = tryOpenSocket(
    {
      url: conn.url,
      onConnectionChange: (connected) => {
        notify(conn, connected);
      },
      onEvent: (event) => {
        for (const sub of conn.subscribers) sub.onEvent?.(event);
      },
    },
    {
      onOpen: () => {
        if (conn.subscribers.size === 0) {
          teardown(conn);
          return;
        }
        conn.connected = true;
        conn.retryDelay = 1000;
        notify(conn, true);
      },
      onClose: () => {
        conn.ws = undefined;
        if (conn.connected) {
          conn.connected = false;
          notify(conn, false);
        }
        scheduleReconnect(conn);
      },
    },
  );
  if (conn.ws === undefined && readSessionToken() !== undefined) scheduleReconnect(conn);
}

function teardown(conn: SharedConnection): void {
  connections.delete(conn.url);
  if (conn.reconnectTimer !== undefined) clearTimeout(conn.reconnectTimer);
  conn.reconnectTimer = undefined;
  conn.connected = false;
  const ws = conn.ws;
  conn.ws = undefined;
  if (ws !== undefined) {
    ws.onclose = () => {};
    ws.close();
  }
}

function unsubscribe(conn: SharedConnection, sub: Subscriber): void {
  conn.subscribers.delete(sub);
  if (conn.subscribers.size > 0) return;
  // Still connecting: `onOpen` closes it, unless a new subscriber arrives first.
  if (conn.ws !== undefined && conn.ws.readyState === SOCKET_CONNECTING) return;
  teardown(conn);
}

export function createEventsClient(options?: EventsClientOptions): EventsClient {
  const url = options?.url ?? defaultWsUrl();
  let conn = connections.get(url);
  if (conn === undefined) {
    conn = {
      url,
      subscribers: new Set(),
      ws: undefined,
      connected: false,
      reconnectTimer: undefined,
      retryDelay: 1000,
    };
    connections.set(url, conn);
  }
  const shared = conn;
  const sub: Subscriber = {
    onConnectionChange: options?.onConnectionChange,
    onEvent: options?.onEvent,
  };
  shared.subscribers.add(sub);
  let subscribed = true;
  if (shared.connected) sub.onConnectionChange?.(true);
  else if (shared.ws === undefined && shared.reconnectTimer === undefined) connect(shared);

  return {
    close(): void {
      if (!subscribed) return;
      subscribed = false;
      unsubscribe(shared, sub);
    },
    isConnected: () => subscribed && shared.connected,
  };
}
