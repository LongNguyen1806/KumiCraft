// Tests for chat sessions: each turn keeps its conversation, an earlier one can be resumed (K9.5).
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  realFs,
  setupTurnRunnerTest,
  type TestTurnEnv,
  waitForJobEnd,
  writeTestProjectFiles,
} from './test-support.ts';
import { createTurnStore } from './turn-store.ts';

const PROJECT_ID = 'p_12345678';

/** A fake agent run that reports the conversation id `id`. */
async function scriptFor(dir: string, id: string): Promise<string> {
  const path = join(dir, `${id}.json`);
  await writeFile(
    path,
    JSON.stringify({
      steps: [
        { emit: { event: 'init', conversation_id: id } },
        { emit: { event: 'result', result: { status: 'SUCCESS' } } },
      ],
    }),
  );
  return path;
}

function argvOf(recordPath: string): readonly string[] {
  const data = z
    .object({ argv: z.array(z.string()) })
    .parse(JSON.parse(readFileSync(recordPath, 'utf8')));
  return data.argv;
}

describe('TurnRunner conversations [K9.5]', () => {
  let tempDir: string;
  let env: TestTurnEnv;

  async function run(prompt: string, conversation: 'new' | 'continue', id: string) {
    process.env['RC_FAKE_AGENT_SCRIPT'] = await scriptFor(tempDir, id);
    process.env['RC_FAKE_AGENT_RECORD'] = join(tempDir, `${prompt}.rec.json`);
    const res = await env.turnRunner.start({ prompt, context: {}, conversation, docs: [] });
    if (!res.ok) throw new Error(res.error.code);
    await waitForJobEnd(env.eventBus, res.value.jobId);
    return res.value.turnId;
  }

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kc-turn-conv-'));
    env = setupTurnRunnerTest(tempDir);
    await writeTestProjectFiles(env.projectRoot, env.dataDir, env.cacheDir);
  });

  afterEach(async () => {
    delete process.env['RC_FAKE_AGENT_SCRIPT'];
    delete process.env['RC_FAKE_AGENT_RECORD'];
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore transient Windows directory lock
    }
  });

  it('each turn keeps the conversation it ran in; resume makes an earlier one continue', async () => {
    const first = await run('a1', 'new', 'conv-a');
    const second = await run('b1', 'new', 'conv-b');
    expect(await env.turnRunner.conversation()).toEqual({
      ok: true,
      value: { agent: 'agy', id: 'conv-b' },
    });

    const resumed = await env.turnRunner.resume('conv-a');
    expect(resumed).toEqual({ ok: true, value: { agent: 'agy', id: 'conv-a' } });
    const third = await run('a2', 'continue', 'conv-a');

    const argv = argvOf(join(tempDir, 'a2.rec.json'));
    expect(argv[argv.indexOf('--conversation') + 1]).toBe('conv-a');
    const turns = await env.store.list(PROJECT_ID);
    const byId = new Map(turns.map((t) => [t.id, t.conversation]));
    expect([byId.get(first), byId.get(second), byId.get(third)]).toEqual([
      'conv-a',
      'conv-b',
      'conv-a',
    ]);
  });

  it('refuses an id no turn of this project ran in', async () => {
    await run('a1', 'new', 'conv-a');
    const res = await env.turnRunner.resume('someone-elses-session');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('E015');
    expect(await env.turnRunner.conversation()).toEqual({
      ok: true,
      value: { agent: 'agy', id: 'conv-a' },
    });
  });

  it('keeps old summaries for the session list but only the newest ones revertible', async () => {
    const store = createTurnStore(
      { fs: realFs, dataDir: env.dataDir },
      { keepTurns: 5, revertibleTurns: 2 },
    );
    for (let i = 0; i < 4; i += 1) {
      await store.save(PROJECT_ID, {
        id: `turn000${String(i)}ab`,
        agent: 'agy',
        startedAt: new Date(2026, 10, 7, 10, i).toISOString(),
        prompt: `p${String(i)}`,
        state: 'completed',
        files: [],
        revertible: true,
        notices: [],
      });
    }
    const list = await store.list(PROJECT_ID);
    expect(list.map((t) => t.revertible)).toEqual([true, true, false, false]);
  });
});
