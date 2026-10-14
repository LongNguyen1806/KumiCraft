// Unit tests for real-time WebSocket events client.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createEventsClient, type StudioServerEvent } from './events-client.ts';

let activeSockets: MockWebSocket[] = [];

class MockWebSocket {
  onopen: (() => void) | undefined = undefined;
  onmessage: ((event: { data: string }) => void) | undefined = undefined;
  onclose: (() => void) | undefined = undefined;
  onerror: (() => void) | undefined = undefined;
  readyState = 1;
  protocols: string[];
  url: string;

  constructor(url: string, protocols: string[]) {
    this.url = url;
    this.protocols = protocols;
    activeSockets.push(this);
    setTimeout(() => {
      this.onopen?.();
    }, 5);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }
}

describe('events-client', () => {
  beforeEach(() => {
    activeSockets = [];
    sessionStorage.setItem('reactcraft.sessionToken', 'token-events-456');
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('connects with session token subprotocol and reports connected state', async () => {
    let isConnected = false;
    const client = createEventsClient({
      url: 'ws://127.0.0.1:4000/api/v1/events',
      onConnectionChange: (c) => {
        isConnected = c;
      },
    });

    await vi.waitFor(() => {
      expect(isConnected).toBe(true);
    });

    expect(client.isConnected()).toBe(true);
    client.close();
    expect(client.isConnected()).toBe(false);
  });

  it('reports disconnected immediately if session token is missing', () => {
    sessionStorage.clear();
    let isConnected = true;
    const client = createEventsClient({
      url: 'ws://127.0.0.1:4000/api/v1/events',
      onConnectionChange: (c) => {
        isConnected = c;
      },
    });

    expect(isConnected).toBe(false);
    expect(client.isConnected()).toBe(false);
    client.close();
  });

  it('dispatches parsed server events and ignores malformed payloads safely', async () => {
    let received: StudioServerEvent | undefined;
    const client = createEventsClient({
      url: 'ws://127.0.0.1:4000/api/v1/events',
      onEvent: (e) => {
        received = e;
      },
    });

    await vi.waitFor(() => {
      expect(client.isConnected()).toBe(true);
    });

    const ws = activeSockets[0];
    expect(ws).toBeDefined();

    // Send malformed payload - should not throw or change received
    ws?.onmessage?.({ data: '{ invalid json ...' });
    expect(received).toBeUndefined();

    // Send valid payload
    const eventPayload: StudioServerEvent = {
      v: 1,
      type: 'project.filesChanged',
      at: '2026-01-01T00:00:00.000Z',
      payload: { files: ['src/pages/Home.tsx'] },
    };
    ws?.onmessage?.({ data: JSON.stringify(eventPayload) });
    expect(received).toEqual(eventPayload);

    client.close();
  });

  it('attempts reconnect when socket encounters error or closes unexpectedly', async () => {
    const connectionStates: boolean[] = [];
    const client = createEventsClient({
      url: 'ws://127.0.0.1:4000/api/v1/events',
      onConnectionChange: (c) => {
        connectionStates.push(c);
      },
    });

    await vi.waitFor(() => {
      expect(client.isConnected()).toBe(true);
    });

    // Simulate unexpected disconnect
    const initialSocket = activeSockets[0];
    initialSocket?.close();

    await vi.waitFor(() => {
      expect(client.isConnected()).toBe(false);
    });

    expect(connectionStates).toContain(false);
    client.close();
  });
});
