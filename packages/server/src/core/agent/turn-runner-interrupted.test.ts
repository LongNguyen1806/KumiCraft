// A turn left "running" by a server that stopped mid-turn must not lock the chat (R-AG-16, R-CH-05).
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { TurnSummary } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  SCRIPTS_DIR,
  setupTurnRunnerTest,
  type TestTurnEnv,
  waitForJobEnd,
  writeTestProjectFiles,
} from './test-support.ts';

const PROJECT_ID = 'p_12345678';

const ORPHAN: TurnSummary = {
  id: 'orphan0001',
  agent: 'agy',
  startedAt: '2026-10-22T18:18:54.034Z',
  prompt: 'chạy lệnh remote control',
  state: 'running',
  files: [],
  revertible: false,
  notices: [],
};

describe('TurnRunner interrupted turns [R-AG-16]', () => {
  let tempDir: string;
  let env: TestTurnEnv;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'rc-turn-interrupted-'));
    env = setupTurnRunnerTest(tempDir);
    await writeTestProjectFiles(env.projectRoot, env.dataDir, env.cacheDir);
  });

  afterEach(async () => {
    delete process.env['RC_FAKE_AGENT_SCRIPT'];
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore transient Windows directory lock
    }
  });

  it('reports a turn a previous server left running as failed, and saves that [R-AG-16, R-CH-05]', async () => {
    await env.store.save(PROJECT_ID, ORPHAN);

    const listed = await env.turnRunner.list();

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const turn = listed.value.find((t) => t.id === ORPHAN.id);
    expect(turn?.state).toBe('failed');
    expect(typeof turn?.finishedAt).toBe('string');
    expect((await env.store.get(PROJECT_ID, ORPHAN.id))?.state).toBe('failed');
  });

  it('keeps a turn that is still running in this server as running [R-AG-16]', async () => {
    process.env['RC_FAKE_AGENT_SCRIPT'] = join(SCRIPTS_DIR, 'hang.json');
    const started = await env.turnRunner.start({
      prompt: 'still working',
      context: {},
      conversation: 'new',
      docs: [],
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    let summary = await env.store.get(PROJECT_ID, started.value.turnId);
    for (let i = 0; i < 50 && summary === undefined; i++) {
      await new Promise((r) => setTimeout(r, 50));
      summary = await env.store.get(PROJECT_ID, started.value.turnId);
    }
    const listed = await env.turnRunner.list();
    expect(listed.ok && listed.value.find((t) => t.id === started.value.turnId)?.state).toBe(
      'running',
    );

    const end = waitForJobEnd(env.eventBus, started.value.jobId);
    env.jobs.cancel(started.value.jobId);
    await end;
  });
});
