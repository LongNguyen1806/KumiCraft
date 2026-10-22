// Unit tests for agent-client (WP-3.05a, Situation 1).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAgents, fetchTurnDiff, fetchTurns, revertTurn, startTurn } from './agent-client.ts';
import { ApiError } from './http.ts';

function stubFetchData(data: unknown, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data }), { status }))),
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

describe('agent-client (Situation 1)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('reactcraft.sessionToken', 'tok');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses valid responses for all agent endpoints', async () => {
    const validAgents = [
      {
        id: 'agy',
        installed: true,
        login: 'unknown' as const,
        version: '1.0.0',
        loginAvailable: true,
      },
      { id: 'claude', installed: false, login: 'unknown' as const, loginAvailable: false },
    ];
    stubFetchData(validAgents);
    expect(await fetchAgents()).toEqual(validAgents);

    const validStartTurn = { jobId: 'job12345678' };
    stubFetchData(validStartTurn, 202);
    expect(
      await startTurn({
        prompt: 'test prompt',
        context: {},
        conversation: 'new',
        docs: [],
      }),
    ).toEqual(validStartTurn);

    const validTurn = {
      id: 'turn000001',
      agent: 'agy' as const,
      startedAt: '2026-10-22T00:00:00.000Z',
      prompt: 'hello',
      state: 'completed' as const,
      files: [],
      revertible: true,
      notices: [],
    };
    stubFetchData([validTurn]);
    expect(await fetchTurns()).toEqual([validTurn]);

    stubFetchData({ diff: '--- a\n+++ b' });
    expect(await fetchTurnDiff('turn000001', 'src/App.tsx')).toBe('--- a\n+++ b');

    stubFetchData(validTurn);
    expect(await revertTurn('turn000001')).toEqual(validTurn);
  });

  it('rejects with invalidResponse when fetchTurns response is missing state', async () => {
    const invalidTurn = {
      id: 'turn000001',
      agent: 'agy' as const,
      startedAt: '2026-10-22T00:00:00.000Z',
      prompt: 'hello',
      // missing state
      files: [],
      revertible: true,
      notices: [],
    };
    stubFetchData([invalidTurn]);
    await expectInvalidResponse(fetchTurns());
  });
});
