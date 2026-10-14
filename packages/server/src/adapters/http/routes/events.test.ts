import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createEventBus, type EventBusPort } from '../../../core/ports/event-bus-port.ts';
import { createHttpApp } from '../create-http-app.ts';

const PORT = 50345;
const TOKEN = 'test-token-events';
const HOST = `127.0.0.1:${String(PORT)}`;

describe('WebSocket /api/v1/events', () => {
  let eventBus: EventBusPort;
  let closeServer: () => Promise<void>;

  beforeEach(async () => {
    eventBus = createEventBus();
    const app = await createHttpApp({
      logLevel: 'silent',
      security: { port: PORT, sessionToken: TOKEN, trustedOrigins: [] },
      getSessionInfo: () => ({
        version: '1.0.0',
        platform: 'linux',
        features: [],
        project: { state: 'none', suggestedPath: '/w' },
      }),
      eventRoutes: {
        eventBus,
        sessionToken: TOKEN,
      },
    });

    await app.listen({ host: '127.0.0.1', port: PORT });
    closeServer = () => app.close();
  });

  afterEach(async () => {
    await closeServer();
  });

  it('rejects connection without token with 4401 [S-07]', async () => {
    const ws = new WebSocket(`ws://${HOST}/api/v1/events`);

    const closeCode = await new Promise<number>((resolve) => {
      ws.addEventListener('close', (event) => {
        resolve(event.code);
      });
      ws.addEventListener('error', () => {
        // error event precedes close in standard WebSocket
      });
    });

    expect(closeCode).toBe(4401);
  });

  it('rejects connection with wrong token with 4401 [S-07]', async () => {
    const ws = new WebSocket(`ws://${HOST}/api/v1/events`, [
      'reactcraft.token.wrong-token',
      'reactcraft.v1',
    ]);

    const closeCode = await new Promise<number>((resolve) => {
      ws.addEventListener('close', (event) => {
        resolve(event.code);
      });
      ws.addEventListener('error', () => {
        // ignore
      });
    });

    expect(closeCode).toBe(4401);
  });

  it('accepts connection with valid token and receives broadcast events [S-07, 11.2]', async () => {
    const ws = new WebSocket(`ws://${HOST}/api/v1/events`, [
      `reactcraft.token.${TOKEN}`,
      'reactcraft.v1',
    ]);

    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => {
        resolve();
      });
      ws.addEventListener('error', reject);
    });

    expect(ws.protocol).toBe('reactcraft.v1');

    const receivedPromise = new Promise<string>((resolve) => {
      ws.addEventListener('message', (event: { data: unknown }) => {
        resolve(typeof event.data === 'string' ? event.data : String(event.data));
      });
    });

    eventBus.publish('project.filesChanged', { files: ['src/App.tsx'] });

    const raw = await receivedPromise;
    const event = JSON.parse(raw) as {
      v: number;
      type: string;
      at: string;
      payload: { files: string[] };
    };

    expect(event.v).toBe(1);
    expect(event.type).toBe('project.filesChanged');
    expect(event.payload.files).toEqual(['src/App.tsx']);

    ws.close();
  });
});
