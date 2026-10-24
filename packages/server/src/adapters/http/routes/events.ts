// WebSocket /api/v1/events endpoint (SPEC-03 section 6, SPEC-05 section 3).
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';

import type { EventBusPort } from '../../../core/ports/event-bus-port.ts';
import { isTokenValid } from '../security.ts';

const TOKEN_PROTOCOL_PREFIX = 'kumicraft.token.';
const PING_INTERVAL_MS = 20_000; // SPEC-03 section 6

export type EventRoutesDeps = {
  readonly eventBus: EventBusPort;
  readonly sessionToken: string;
};

function extractTokenFromProtocols(header: string | undefined): string | undefined {
  if (header === undefined) return undefined;
  const parts = header.split(',').map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(TOKEN_PROTOCOL_PREFIX)) {
      return part.slice(TOKEN_PROTOCOL_PREFIX.length);
    }
  }
  return undefined;
}

function verifyWebSocketAuth(request: FastifyRequest, sessionToken: string): boolean {
  const protocolsHeader = request.headers['sec-websocket-protocol'];
  const token = extractTokenFromProtocols(protocolsHeader);
  if (token === undefined) return false;
  return isTokenValid(`Bearer ${token}`, sessionToken);
}

function setupHeartbeat(socket: WebSocket): () => void {
  let isAlive = true;

  socket.on('pong', () => {
    isAlive = true;
  });

  const timer = setInterval(() => {
    if (!isAlive) {
      socket.terminate();
      return;
    }
    isAlive = false;
    socket.ping();
  }, PING_INTERVAL_MS);

  return () => {
    clearInterval(timer);
  };
}

export function registerEventRoutes(api: FastifyInstance, deps: EventRoutesDeps): void {
  api.get('/events', { websocket: true }, (socket, request) => {
    const authorized = verifyWebSocketAuth(request, deps.sessionToken);
    if (!authorized) {
      // S-07: Close connection with 4401 on missing or invalid token
      socket.close(4401, 'Unauthorized');
      return;
    }

    const clearHeartbeat = setupHeartbeat(socket);

    const unsubscribe = deps.eventBus.subscribe((event) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(event));
      }
    });

    const cleanup = () => {
      clearHeartbeat();
      unsubscribe();
    };

    socket.on('close', cleanup);
    socket.on('error', cleanup);
  });
}
