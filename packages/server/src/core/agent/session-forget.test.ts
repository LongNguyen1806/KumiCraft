// Removing a chat session from KumiCraft's own list (owner, 2026-11-15).
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { TurnSummary } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { forgetConversation } from './session-forget.ts';
import { realFs } from './test-support.ts';
import { createTurnStore, type TurnStore } from './turn-store.ts';

const PROJECT = 'proj000001';

function turn(id: string, conversation: string | undefined, state = 'completed'): TurnSummary {
  return {
    id: `turn0000${id}`,
    agent: 'agy',
    startedAt: '2026-11-15T01:00:00.000Z',
    prompt: `prompt ${id}`,
    state: state === 'running' ? 'running' : 'completed',
    files: [],
    revertible: false,
    notices: [],
    ...(conversation === undefined ? {} : { conversation }),
  };
}

describe('forgetConversation', () => {
  let dataDir: string;
  let store: TurnStore;
  const snapshots = { forget: vi.fn<(p: string, ids: readonly string[]) => Promise<void>>() };

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'rc-forget-'));
    store = createTurnStore({ fs: realFs, dataDir });
    snapshots.forget.mockReset();
    snapshots.forget.mockResolvedValue(undefined);
    for (const t of [turn('t1', 'conv-a'), turn('t2', 'conv-b'), turn('t3', 'conv-a')]) {
      await store.save(PROJECT, t);
    }
    await store.save(PROJECT, turn('t0', undefined));
    await store.setConversation(PROJECT, { agent: 'agy', id: 'conv-a' });
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('drops only that session, its undo snapshots and the "continue" pointer to it', async () => {
    const res = await forgetConversation({ store, snapshots }, PROJECT, 'conv-a');
    expect(res.ok && res.value.removed).toBe(2);
    expect((await store.list(PROJECT)).map((t) => t.id).sort()).toEqual([
      'turn0000t0',
      'turn0000t2',
    ]);
    expect(snapshots.forget).toHaveBeenCalledWith(
      PROJECT,
      expect.arrayContaining(['turn0000t1', 'turn0000t3']),
    );
    expect(await store.conversation(PROJECT)).toBeUndefined();

    const legacy = await forgetConversation({ store, snapshots }, PROJECT, undefined);
    expect(legacy.ok && legacy.value.removed).toBe(1);
    expect((await store.list(PROJECT)).map((t) => t.id)).toEqual(['turn0000t2']);
  });

  it('refuses an unknown session and one with a turn still running', async () => {
    const unknown = await forgetConversation({ store, snapshots }, PROJECT, 'conv-x');
    expect(!unknown.ok && unknown.error.code).toBe('E015');

    await store.save(PROJECT, turn('t4', 'conv-b', 'running'));
    const busy = await forgetConversation({ store, snapshots }, PROJECT, 'conv-b');
    expect(!busy.ok && busy.error.code).toBe('E018');
    expect((await store.list(PROJECT)).some((t) => t.id === 'turn0000t2')).toBe(true);
  });
});
