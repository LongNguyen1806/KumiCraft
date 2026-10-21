// Tests for agent turn HTTP routes (WP-3.03b, R-AG-15).
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { TurnSummary } from '@reactcraft/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  SCRIPTS_DIR,
  setupTurnRunnerTest,
  type TestTurnEnv,
  waitForJobEnd,
  writeTestProjectFiles,
} from '../../../core/agent/test-support.ts';
import { createSessionInfoProvider } from '../../../core/shared/session.ts';
import { createHttpApp } from '../create-http-app.ts';

const PORT = 50298;
const TOKEN = 'test-token-agent-turn-routes';
const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
  'content-type': 'application/json',
};

type StartResponseBody = {
  readonly data: { readonly jobId: string };
};

type TurnsResponseBody = {
  readonly data: readonly TurnSummary[];
};

type DiffResponseBody = {
  readonly data: { readonly diff: string };
};

type RevertResponseBody = {
  readonly data: TurnSummary;
};

type ErrorResponseBody = {
  readonly error: {
    readonly code: string;
    readonly params?: { readonly reason?: string };
  };
};

describe('Agent turns routes [R-AG-15]', () => {
  let tempDir: string;
  let env: TestTurnEnv;
  let app: FastifyInstance;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'rc-agent-turn-routes-'));
    env = setupTurnRunnerTest(tempDir);
    await writeTestProjectFiles(env.projectRoot, env.dataDir, env.cacheDir);

    app = await createHttpApp({
      logLevel: 'silent',
      security: { port: PORT, sessionToken: TOKEN, trustedOrigins: [] },
      getSessionInfo: createSessionInfoProvider({
        version: '1.0.0',
        platform: 'linux',
        features: [],
        readProject: () => ({ state: 'open', id: 'p_12345678', name: 'test', trusted: true }),
      }),
      agentTurnRoutes: { turnRunner: env.turnRunner },
    });
  });

  afterEach(async () => {
    delete process.env['RC_FAKE_AGENT_SCRIPT'];
    await app.close();
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore transient Windows directory lock
    }
  });

  it('[R-AG-15] 13. serves HTTP routes for starting turns, diffing files, and reverting changes', async () => {
    const badReq = await app.inject({
      method: 'POST',
      url: '/api/v1/agent/turns',
      headers: HEADERS,
      body: JSON.stringify({ prompt: 123 }),
    });
    expect(badReq.statusCode).toBe(400);

    process.env['RC_FAKE_AGENT_SCRIPT'] = join(SCRIPTS_DIR, 'success-edit.json');
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/v1/agent/turns',
      headers: HEADERS,
      body: JSON.stringify({ prompt: 'route edit', context: {}, conversation: 'new', docs: [] }),
    });
    expect(startRes.statusCode).toBe(202);
    const startData = startRes.json<StartResponseBody>().data;
    const endEv = await waitForJobEnd(env.eventBus, startData.jobId);
    expect(endEv.type).toBe('job.completed');

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/agent/turns',
      headers: HEADERS,
    });
    expect(listRes.statusCode).toBe(200);
    const turns = listRes.json<TurnsResponseBody>().data;
    expect(turns).toHaveLength(1);
    const turnId = turns[0]?.id ?? '';

    const diffRes = await app.inject({
      method: 'GET',
      url: `/api/v1/agent/turns/${turnId}/diff?file=src/App.tsx`,
      headers: HEADERS,
    });
    expect(diffRes.statusCode).toBe(200);
    const diffData = diffRes.json<DiffResponseBody>().data;
    expect(diffData.diff).toContain('+');

    const revertRes = await app.inject({
      method: 'POST',
      url: `/api/v1/agent/turns/${turnId}/revert`,
      headers: HEADERS,
    });
    expect(revertRes.statusCode).toBe(200);
    const revSummary = revertRes.json<RevertResponseBody>().data;
    expect(revSummary.revertible).toBe(false);

    const appContent = await readFile(join(env.projectRoot, 'src/App.tsx'), 'utf8');
    expect(appContent).toContain('// initial App');

    const revAgain = await app.inject({
      method: 'POST',
      url: `/api/v1/agent/turns/${turnId}/revert`,
      headers: HEADERS,
    });
    expect(revAgain.statusCode).toBe(400);
    const revErr = revAgain.json<ErrorResponseBody>().error;
    expect(revErr.code).toBe('E016');
    expect(revErr.params?.reason).toBe('alreadyReverted');
  });
});
