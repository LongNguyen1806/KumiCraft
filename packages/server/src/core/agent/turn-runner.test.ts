// Tests for turn runner core lifecycle (WP-3.03b, R-AG-11, R-AG-12, R-AG-14, R-AG-17, S-110 to S-116).
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  type AgentEvent,
  AgentEventSchema,
  type BackendInfo,
  TurnSummarySchema,
} from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { err } from '../shared/result.ts';
import {
  getLastSpawnedPid,
  makeTestProjectInfo,
  SCRIPTS_DIR,
  setupTurnRunnerTest,
  type TestTurnEnv,
  waitForFirstAgentEvent,
  waitForJobEnd,
  writeTestProjectFiles,
} from './test-support.ts';

const RecordSchema = z.object({
  argv: z.array(z.string()),
  cwd: z.string(),
});

function readRecordJson(recordPath: string): { argv: string[]; cwd: string } {
  const content = readFileSync(recordPath, 'utf8');
  return RecordSchema.parse(JSON.parse(content));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && Boolean(value);
}

describe('TurnRunner core lifecycle [WP-3.03b]', () => {
  let tempDir: string;
  let env: TestTurnEnv;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'rc-turn-runner-'));
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

  it('[R-AG-11, S-110] 2. start rejects unopen, untrusted, uninstalled agent, or missing doc without running agent', async () => {
    const recordFile = join(tempDir, 'rec2.json');
    process.env['RC_FAKE_AGENT_RECORD'] = recordFile;

    const notOpenEnv = setupTurnRunnerTest(tempDir, {
      projectError: err({ code: 'E021', params: { reason: 'notOpen' } }),
    });
    const res1 = await notOpenEnv.turnRunner.start({
      prompt: 'p',
      context: {},
      conversation: 'new',
      docs: [],
    });
    expect(res1.ok).toBe(false);
    if (!res1.ok) expect(res1.error.code).toBe('E021');

    const untrustedEnv = setupTurnRunnerTest(tempDir, {
      projectInfo: makeTestProjectInfo(env.projectRoot, { trusted: false }),
    });
    const res2 = await untrustedEnv.turnRunner.start({
      prompt: 'p',
      context: {},
      conversation: 'new',
      docs: [],
    });
    expect(res2.ok).toBe(false);
    if (!res2.ok) expect(res2.error.code).toBe('E011');

    const noAgentEnv = setupTurnRunnerTest(tempDir, {
      userSettings: { language: 'vi', editor: 'vscode', agent: { preferred: 'claude' } },
    });
    const res3 = await noAgentEnv.turnRunner.start({
      prompt: 'p',
      context: {},
      conversation: 'new',
      docs: [],
    });
    expect(res3.ok).toBe(false);
    if (!res3.ok) expect(res3.error.code).toBe('E026');

    const res4 = await env.turnRunner.start({
      prompt: 'p',
      context: {},
      conversation: 'new',
      docs: ['docs/none.md'],
    });
    expect(res4.ok).toBe(false);
    if (!res4.ok) expect(res4.error.code).toBe('E015');

    expect(existsSync(recordFile)).toBe(false);
  });

  it('[R-AG-12] 3. runs success-edit.json to completion with modified files and ordered agent events', async () => {
    process.env['RC_FAKE_AGENT_SCRIPT'] = join(SCRIPTS_DIR, 'success-edit.json');
    const events: AgentEvent[] = [];
    const turnIds: string[] = [];

    env.eventBus.subscribe((e) => {
      if (e.type === 'agent.event' && isRecord(e.payload)) {
        if (typeof e.payload['turnId'] === 'string') turnIds.push(e.payload['turnId']);
        const evParse = AgentEventSchema.safeParse(e.payload['event']);
        if (evParse.success) events.push(evParse.data);
      }
    });

    const startRes = await env.turnRunner.start({
      prompt: 'update app',
      context: {},
      conversation: 'new',
      docs: [],
    });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    const endEv = await waitForJobEnd(env.eventBus, startRes.value.jobId);
    expect(endEv.type).toBe('job.completed');
    const summaryParse = isRecord(endEv.payload)
      ? TurnSummarySchema.safeParse(endEv.payload['result'])
      : undefined;

    expect(summaryParse?.success).toBe(true);
    if (summaryParse?.success) {
      expect(summaryParse.data.state).toBe('completed');
      expect(summaryParse.data.revertible).toBe(true);
      expect(summaryParse.data.files).toEqual([
        { path: 'src/App.tsx', change: 'modified' },
        { path: 'src/main.tsx', change: 'modified' },
        { path: 'src/pages/Products.tsx', change: 'created' },
      ]);
    }
    expect(events.length).toBeGreaterThan(0);
    expect(turnIds.every((id) => id === startRes.value.turnId)).toBe(true);
  });

  it('[S-111, S-112] 4. passes mirror dir to agent and omits real backend path and forbidden flags', async () => {
    const backendDir = join(tempDir, 'backend-real');
    await writeTestProjectFiles(backendDir);
    const backendInfo: BackendInfo = {
      id: 'b1',
      label: 'api',
      path: '../backend-real',
      resolvedPath: backendDir,
      status: 'ok',
      outsideParent: false,
    };
    const bEnv = setupTurnRunnerTest(tempDir, {
      projectInfo: makeTestProjectInfo(env.projectRoot, { backends: [backendInfo] }),
    });

    const recordFile = join(tempDir, 'rec4.json');
    process.env['RC_FAKE_AGENT_RECORD'] = recordFile;
    process.env['RC_FAKE_AGENT_SCRIPT'] = join(SCRIPTS_DIR, 'success-edit.json');

    const startRes = await bEnv.turnRunner.start({
      prompt: 'check backend',
      context: {},
      conversation: 'new',
      docs: [],
    });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    await waitForJobEnd(bEnv.eventBus, startRes.value.jobId);
    expect(existsSync(recordFile)).toBe(true);

    const rec = readRecordJson(recordFile);
    expect(rec.cwd).toBe(env.projectRoot);
    expect(rec.argv).toContain('--add-dir');
    const addDirIdx = rec.argv.indexOf('--add-dir');
    expect(rec.argv[addDirIdx + 1]).toContain(join(bEnv.cacheDir, 'mirrors', 'p_12345678', 'b1'));
    expect(rec.argv.join(' ')).not.toContain(backendDir);
    expect(rec.argv).not.toContain('--dangerously-skip-permissions');
    expect(rec.argv).not.toContain('--mode');
    expect(rec.argv).not.toContain('--sandbox');
    expect(rec.argv).not.toContain('--permission-mode');
  });

  it('[R-AG-11] 5. rejects start with E018 when another agent turn is already running', async () => {
    process.env['RC_FAKE_AGENT_SCRIPT'] = join(SCRIPTS_DIR, 'hang.json');

    const res1 = await env.turnRunner.start({
      prompt: 'first',
      context: {},
      conversation: 'new',
      docs: [],
    });
    expect(res1.ok).toBe(true);
    if (!res1.ok) return;

    const res2 = await env.turnRunner.start({
      prompt: 'second',
      context: {},
      conversation: 'new',
      docs: [],
    });
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.error.code).toBe('E018');
    }

    const endPromise = waitForJobEnd(env.eventBus, res1.value.jobId);
    env.jobs.cancel(res1.value.jobId);
    await endPromise;

    let summary = await env.store.get('p_12345678', res1.value.turnId);
    for (let i = 0; i < 50 && summary?.state !== 'cancelled'; i++) {
      await new Promise((r) => setTimeout(r, 50));
      summary = await env.store.get('p_12345678', res1.value.turnId);
    }
  });

  it('[R-AG-17] 6. records failed TurnSummary and modified files on agent exit code 1', async () => {
    process.env['RC_FAKE_AGENT_SCRIPT'] = join(SCRIPTS_DIR, 'fail-midway.json');

    const startRes = await env.turnRunner.start({
      prompt: 'fail test',
      context: {},
      conversation: 'new',
      docs: [],
    });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    const endEv = await waitForJobEnd(env.eventBus, startRes.value.jobId);
    expect(endEv.type).toBe('job.failed');
    if (isRecord(endEv.payload) && isRecord(endEv.payload['error'])) {
      const errObj = endEv.payload['error'];
      expect(errObj['code']).toBe('E027');
      if (isRecord(errObj['params'])) {
        expect(errObj['params']['agent']).toBe('agy');
        expect(errObj['params']['exitCode']).toBe(1);
      }
    }

    const summary = await env.store.get('p_12345678', startRes.value.turnId);
    expect(summary?.state).toBe('failed');
    expect(summary?.files).toEqual([{ path: 'src/App.tsx', change: 'modified' }]);
    expect(summary?.revertible).toBe(true);
  });

  it('[R-AG-14, S-116] 7. cancels running turn, kills agent process, and records cancelled summary', async () => {
    process.env['RC_FAKE_AGENT_SCRIPT'] = join(SCRIPTS_DIR, 'hang.json');

    const startRes = await env.turnRunner.start({
      prompt: 'cancel me',
      context: {},
      conversation: 'new',
      docs: [],
    });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    await waitForFirstAgentEvent(env.eventBus, startRes.value.turnId);
    const endPromise = waitForJobEnd(env.eventBus, startRes.value.jobId);
    const cancelRes = env.jobs.cancel(startRes.value.jobId);
    expect(cancelRes.ok).toBe(true);

    const endEv = await endPromise;
    expect(endEv.type).toBe('job.cancelled');

    let summary = await env.store.get('p_12345678', startRes.value.turnId);
    for (let i = 0; i < 50 && summary?.state !== 'cancelled'; i++) {
      await new Promise((r) => setTimeout(r, 50));
      summary = await env.store.get('p_12345678', startRes.value.turnId);
    }
    expect(summary?.state).toBe('cancelled');

    const pid = getLastSpawnedPid();
    expect(pid).toBeDefined();
    if (pid !== undefined) {
      expect(() => process.kill(pid, 0)).toThrow();
    }
  });

  it('Situation 17: passes image directory and adds image prompt [R-CH-02]', async () => {
    const png = new Uint8Array(100);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const saveRes = await env.chatImages.save('p_12345678', 'png', png);
    expect(saveRes.ok).toBe(true);
    if (!saveRes.ok) return;

    const recordFile = join(tempDir, 'rec-img17.json');
    process.env['RC_FAKE_AGENT_RECORD'] = recordFile;
    process.env['RC_FAKE_AGENT_SCRIPT'] = join(SCRIPTS_DIR, 'success-edit.json');

    const startRes = await env.turnRunner.start({
      prompt: 'clone this UI',
      context: {},
      conversation: 'new',
      docs: [],
      images: [saveRes.value.id],
    });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    await waitForJobEnd(env.eventBus, startRes.value.jobId);
    expect(existsSync(recordFile)).toBe(true);

    const rec = readRecordJson(recordFile);
    expect(rec.argv).toContain('--add-dir');
    const imageDir = env.chatImages.dirOf('p_12345678');
    expect(rec.argv).toContain(imageDir);

    const fullArgv = rec.argv.join(' ');
    expect(fullArgv).toContain('Images the user attached (read them with your file tools):');
    expect(fullArgv).toContain(join(imageDir, `${saveRes.value.id}.png`));
  });

  it('Situation 18: rejects missing images with E015 without starting agent [R-CH-02]', async () => {
    const startRes = await env.turnRunner.start({
      prompt: 'use missing image',
      context: {},
      conversation: 'new',
      docs: [],
      images: ['missingId01'],
    });
    expect(startRes).toEqual({
      ok: false,
      error: { code: 'E015', params: { resource: 'image', id: 'missingId01' } },
    });
  });

  it('Situation 19: turn without images retains identical prompt and arguments [R-CH-02]', async () => {
    const recordFile = join(tempDir, 'rec-img19.json');
    process.env['RC_FAKE_AGENT_RECORD'] = recordFile;
    process.env['RC_FAKE_AGENT_SCRIPT'] = join(SCRIPTS_DIR, 'success-edit.json');

    const startRes = await env.turnRunner.start({
      prompt: 'no image turn',
      context: {},
      conversation: 'new',
      docs: [],
      images: [],
    });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    await waitForJobEnd(env.eventBus, startRes.value.jobId);
    const rec = readRecordJson(recordFile);
    const fullArgv = rec.argv.join(' ');
    expect(fullArgv).not.toContain('Images the user attached');
    expect(fullArgv).not.toContain('chat-images');
  });
});
