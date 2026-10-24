// Tests for turn runner options, session modes, notices, and limits (WP-3.03b, R-AG-14, R-AG-16, S-32, S-113, S-116, S-118).
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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

import {
  makeTestProjectInfo,
  realFs,
  SCRIPTS_DIR,
  setupTurnRunnerTest,
  type TestTurnEnv,
  waitForJobEnd,
  writeTestProjectFiles,
} from './test-support.ts';
import { createTurnStore } from './turn-store.ts';

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

describe('TurnRunner session, notices, and limits [WP-3.03b]', () => {
  let tempDir: string;
  let env: TestTurnEnv;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'rc-turn-session-'));
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

  it('[R-AG-14, S-116] 8. times out hanging agent after configured timeoutMs and records E020 failure', async () => {
    const tEnv = setupTurnRunnerTest(tempDir, { timeoutMs: 500 });
    await writeTestProjectFiles(tEnv.projectRoot, tEnv.dataDir, tEnv.cacheDir);
    process.env['RC_FAKE_AGENT_SCRIPT'] = join(SCRIPTS_DIR, 'hang.json');

    const startRes = await tEnv.turnRunner.start({
      prompt: 'timeout test',
      context: {},
      conversation: 'new',
      docs: [],
    });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    const endEv = await waitForJobEnd(tEnv.eventBus, startRes.value.jobId);
    expect(endEv.type).toBe('job.failed');
    if (isRecord(endEv.payload) && isRecord(endEv.payload['error'])) {
      const errObj = endEv.payload['error'];
      expect(errObj['code']).toBe('E020');
      if (isRecord(errObj['params'])) {
        expect(errObj['params']['operation']).toBe('agent');
        expect(errObj['params']['timeoutMs']).toBe(500);
      }
    }

    const summary = await tEnv.store.get('p_12345678', startRes.value.turnId);
    expect(summary?.state).toBe('failed');
  });

  it('[R-AG-16] 9. preserves conversation id on continue mode and resets on new mode', async () => {
    const rec1 = join(tempDir, 'c1.json');
    const rec2 = join(tempDir, 'c2.json');
    const rec3 = join(tempDir, 'c3.json');

    process.env['RC_FAKE_AGENT_RECORD'] = rec1;
    const res1 = await env.turnRunner.start({
      prompt: 'turn 1',
      context: {},
      conversation: 'new',
      docs: [],
    });
    if (res1.ok) await waitForJobEnd(env.eventBus, res1.value.jobId);

    process.env['RC_FAKE_AGENT_RECORD'] = rec2;
    const res2 = await env.turnRunner.start({
      prompt: 'turn 2',
      context: {},
      conversation: 'continue',
      docs: [],
    });
    if (res2.ok) await waitForJobEnd(env.eventBus, res2.value.jobId);

    process.env['RC_FAKE_AGENT_RECORD'] = rec3;
    const res3 = await env.turnRunner.start({
      prompt: 'turn 3',
      context: {},
      conversation: 'new',
      docs: [],
    });
    if (res3.ok) await waitForJobEnd(env.eventBus, res3.value.jobId);

    expect(readRecordJson(rec1).argv).not.toContain('--conversation');
    const argv2 = readRecordJson(rec2).argv;
    expect(argv2).toContain('--conversation');
    expect(argv2[argv2.indexOf('--conversation') + 1]).toBe('fake-conv-1');
    expect(readRecordJson(rec3).argv).not.toContain('--conversation');
  });

  it('[R-AG-16] 10. keeps at most keepTurns summaries and lists newest first', async () => {
    const kEnv = setupTurnRunnerTest(tempDir, { keepTurns: 3 });
    await writeTestProjectFiles(kEnv.projectRoot, kEnv.dataDir, kEnv.cacheDir);
    const turnIds: string[] = [];

    for (let i = 1; i <= 4; i++) {
      const res = await kEnv.turnRunner.start({
        prompt: `turn ${String(i)}`,
        context: {},
        conversation: 'new',
        docs: [],
      });
      if (res.ok) {
        turnIds.push(res.value.turnId);
        await waitForJobEnd(kEnv.eventBus, res.value.jobId);
      }
    }

    const newStore = createTurnStore({ fs: realFs, dataDir: kEnv.dataDir });
    const list = await newStore.list('p_12345678');
    expect(list).toHaveLength(3);
    expect(list.map((t) => t.id)).toEqual([turnIds[3], turnIds[2], turnIds[1]]);
  });

  it('[S-32] 11. redacts secrets in message text and tool target before emitting agent events', async () => {
    const scriptPath = join(tempDir, 'secret-script.json');
    await writeFile(
      scriptPath,
      JSON.stringify({
        steps: [
          { emit: { event: 'init', conversation_id: 'fake-conv-1' } },
          {
            emit: {
              event: 'step_update',
              step_update: {
                step_type: 'agent_response',
                text_delta: 'password=RC_SECRET_MARKER_9 done',
              },
            },
          },
          {
            emit: {
              event: 'step_update',
              step_update: {
                step_type: 'tool',
                state: 'ACTIVE',
                tool_name: 'read_file',
                tool_info: { parameters: { Path: 'src/api_key=RC_SECRET_MARKER_8.ts' } },
              },
            },
          },
          { emit: { event: 'result', result: { status: 'SUCCESS' } } },
        ],
      }),
      'utf8',
    );
    process.env['RC_FAKE_AGENT_SCRIPT'] = scriptPath;

    const emitted: AgentEvent[] = [];
    env.eventBus.subscribe((e) => {
      if (e.type === 'agent.event' && isRecord(e.payload)) {
        const evParse = AgentEventSchema.safeParse(e.payload['event']);
        if (evParse.success) emitted.push(evParse.data);
      }
    });

    const res = await env.turnRunner.start({
      prompt: 'secret check',
      context: {},
      conversation: 'new',
      docs: [],
    });
    if (res.ok) await waitForJobEnd(env.eventBus, res.value.jobId);

    const msgEv = emitted.find((e) => e.kind === 'message');
    expect(msgEv).toBeDefined();
    if (msgEv?.kind === 'message') {
      expect(msgEv.text).toContain('«redacted»');
      expect(msgEv.text).not.toContain('RC_SECRET_MARKER_9');
    }

    const toolEv = emitted.find((e) => e.kind === 'tool');
    expect(toolEv).toBeDefined();
    if (toolEv?.kind === 'tool') {
      expect(toolEv.target).toContain('«redacted»');
      expect(toolEv.target).not.toContain('RC_SECRET_MARKER_8');
    }
  });

  it('[R-MR-03, S-118] 12. records backendSkipped notice for missing backend and mirrorModified on mirror edit', async () => {
    const missingBackend: BackendInfo = {
      id: 'b_missing1',
      label: 'missing-api',
      path: '../missing',
      resolvedPath: join(tempDir, 'missing'),
      status: 'missing',
      outsideParent: false,
    };
    const okBackend: BackendInfo = {
      id: 'b_ok_api01',
      label: 'ok-api',
      path: '../ok',
      resolvedPath: join(tempDir, 'ok'),
      status: 'ok',
      outsideParent: false,
    };
    const customMirror = {
      refresh: (_projectId: string, b: BackendInfo) => {
        if (b.id === 'b_missing1') {
          return Promise.resolve({
            backendId: b.id,
            label: b.label,
            state: 'skipped' as const,
            files: 0,
            bytes: 0,
            copied: 0,
          });
        }
        return Promise.resolve({
          backendId: b.id,
          label: b.label,
          state: 'ready' as const,
          dir: join(tempDir, 'mirror-dir'),
          files: 1,
          bytes: 10,
          copied: 1,
        });
      },
      check: () => Promise.resolve('modified' as const),
    };

    const mEnv = setupTurnRunnerTest(tempDir, {
      projectInfo: makeTestProjectInfo(env.projectRoot, { backends: [missingBackend, okBackend] }),
      customMirror,
    });
    await writeTestProjectFiles(mEnv.projectRoot, mEnv.dataDir, mEnv.cacheDir);

    const startRes = await mEnv.turnRunner.start({
      prompt: 'mirror notice check',
      context: {},
      conversation: 'new',
      docs: [],
    });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    const endEv = await waitForJobEnd(mEnv.eventBus, startRes.value.jobId);
    expect(endEv.type).toBe('job.completed');
    const summaryParse = isRecord(endEv.payload)
      ? TurnSummarySchema.safeParse(endEv.payload['result'])
      : undefined;

    expect(summaryParse?.success).toBe(true);
    if (summaryParse?.success) {
      expect(summaryParse.data.notices).toContainEqual({
        code: 'backendSkipped',
        backendId: 'b_missing1',
        label: 'missing-api',
      });
      expect(summaryParse.data.notices).toContainEqual({
        code: 'mirrorModified',
        backendId: 'b_ok_api01',
        label: 'ok-api',
      });
    }
  });

  it('[S-113] 14. fails with projectTooLarge when project exceeds snapshot size limit without running agent', async () => {
    const sEnv = setupTurnRunnerTest(tempDir, { snapshotMaxBytes: 10 });
    await writeTestProjectFiles(sEnv.projectRoot, sEnv.dataDir, sEnv.cacheDir);

    const recordFile = join(tempDir, 'rec14.json');
    process.env['RC_FAKE_AGENT_RECORD'] = recordFile;

    const startRes = await sEnv.turnRunner.start({
      prompt: 'too large test',
      context: {},
      conversation: 'new',
      docs: [],
    });
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    const endEv = await waitForJobEnd(sEnv.eventBus, startRes.value.jobId);
    expect(endEv.type).toBe('job.failed');
    if (isRecord(endEv.payload) && isRecord(endEv.payload['error'])) {
      const errObj = endEv.payload['error'];
      expect(errObj['code']).toBe('E016');
      if (isRecord(errObj['params'])) {
        expect(errObj['params']['reason']).toBe('projectTooLarge');
      }
    }

    expect(existsSync(recordFile)).toBe(false);
  });
});
