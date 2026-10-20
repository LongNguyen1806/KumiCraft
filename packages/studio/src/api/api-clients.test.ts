import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAssets } from './assets-client.ts';
import { createEventsClient } from './events-client.ts';
import { fetchHistoryState } from './history-client.ts';
import { ApiError } from './http.ts';
import { fetchJob } from './jobs-client.ts';
import { fetchProjectTheme, probeProject } from './project-client.ts';
import { fetchRunnerStatus } from './runner-client.ts';
import { fetchSession } from './session.ts';
import { fetchSettings } from './settings-client.ts';
import { editSource, fetchElementSource } from './source-client.ts';

function stubFetchData(data: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data }), { status: 200 }))),
  );
}

async function expectInvalidResponse(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
    expect.fail('Expected ApiError to be thrown');
  } catch (error) {
    if (!(error instanceof ApiError)) {
      expect.fail(`Expected ApiError, got ${String(error)}`);
      return;
    }
    expect(error.code).toBe('E016');
    expect(error.params?.['reason']).toBe('invalidResponse');
  }
}

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem('reactcraft.sessionToken', 'tok');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Studio API schema validation [V-80]', () => {
  it('validates project-client responses and rejects malformed payloads [V-80]', async () => {
    const validProbe = { kind: 'empty' as const };
    stubFetchData(validProbe);
    expect(await probeProject('/tmp')).toEqual(validProbe);

    stubFetchData({ wrong: true });
    await expectInvalidResponse(probeProject('/tmp'));
    await expectInvalidResponse(fetchProjectTheme());
  });

  it('validates runner-client responses and rejects malformed payloads [V-80]', async () => {
    const validRunner = { state: 'ready' as const, origin: 'http://127.0.0.1:5173' };
    stubFetchData(validRunner);
    expect(await fetchRunnerStatus()).toEqual(validRunner);

    stubFetchData({ wrong: true });
    await expectInvalidResponse(fetchRunnerStatus());
  });

  it('validates settings-client responses and rejects malformed payloads [V-80]', async () => {
    const validSettings = { editor: 'vscode' as const, agent: { preferred: 'auto' as const } };
    stubFetchData(validSettings);
    expect(await fetchSettings()).toEqual(validSettings);

    stubFetchData({ wrong: true });
    await expectInvalidResponse(fetchSettings());
  });

  it('validates source-client responses and rejects malformed payloads [V-80]', async () => {
    const validElement = {
      tag: 'div',
      loc: 'src/App.tsx:10:4',
      fileHash: '0'.repeat(64),
      className: { kind: 'static' as const, value: 'p-4' },
      text: { kind: 'static' as const, value: 'Hello' },
      attributes: {},
      inLoop: false,
    };
    stubFetchData(validElement);
    expect(await fetchElementSource({ file: 'src/App.tsx', line: 10, column: 4 })).toEqual(
      validElement,
    );

    stubFetchData({ wrong: true });
    await expectInvalidResponse(fetchElementSource({ file: 'src/App.tsx', line: 10, column: 4 }));
    await expectInvalidResponse(
      editSource({
        edit: { kind: 'setText', loc: 'src/App.tsx:10:4', tag: 'div', before: 'a', after: 'b' },
      }),
    );
  });

  it('validates session responses and rejects malformed payloads [V-80]', async () => {
    const validSession = {
      version: '2.0.0',
      platform: 'win32' as const,
      features: [],
      project: { state: 'none' as const },
    };
    stubFetchData(validSession);
    expect(await fetchSession()).toEqual(validSession);

    stubFetchData({ wrong: true });
    await expectInvalidResponse(fetchSession());
  });

  it('validates history-client, jobs-client and assets-client responses [V-80]', async () => {
    const validHistory = { undoCount: 0, redoCount: 0 };
    stubFetchData(validHistory);
    expect(await fetchHistoryState()).toEqual(validHistory);
    stubFetchData({ wrong: true });
    await expectInvalidResponse(fetchHistoryState());

    const validJob = {
      id: 'job1',
      kind: 'project.install' as const,
      state: 'running' as const,
      startedAt: '2026-10-20T00:00:00Z',
    };
    stubFetchData(validJob);
    expect(await fetchJob('job1')).toEqual(validJob);
    stubFetchData({ wrong: true });
    await expectInvalidResponse(fetchJob('job1'));

    const validAssets = { files: ['src/assets/logo.png'] };
    stubFetchData(validAssets);
    expect(await fetchAssets()).toEqual(validAssets);
    stubFetchData({ wrong: true });
    await expectInvalidResponse(fetchAssets());
  });

  it('validates events-client WebSocket frames and ignores malformed frames [V-80]', () => {
    let messageHandler: ((event: MessageEvent) => void) | undefined;
    class FakeWebSocket {
      onopen: (() => void) | undefined;
      onmessage: ((event: MessageEvent) => void) | undefined;
      onclose: (() => void) | undefined;
      onerror: (() => void) | undefined;
      close(): void {
        // no-op
      }
      constructor() {
        setTimeout(() => {
          messageHandler = this.onmessage;
        }, 0);
      }
    }
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const onEvent = vi.fn();
    const client = createEventsClient({ url: 'ws://127.0.0.1:4310/api/v1/events', onEvent });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const validFrame = {
          v: 1 as const,
          type: 'server.shuttingDown' as const,
          at: '2026-10-20T00:00:00Z',
          payload: {},
        };
        messageHandler?.(new MessageEvent('message', { data: JSON.stringify(validFrame) }));
        messageHandler?.(new MessageEvent('message', { data: JSON.stringify({ v: 99 }) }));

        expect(onEvent).toHaveBeenCalledTimes(1);
        expect(onEvent).toHaveBeenCalledWith(validFrame);
        client.close();
        resolve();
      }, 10);
    });
  });
});
