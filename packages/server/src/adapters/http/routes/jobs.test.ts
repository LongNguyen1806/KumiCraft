// Tests for the job endpoints (SPEC-03 section 4.2).
import { ok } from '@kumicraft/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSessionInfoProvider } from '../../../kernel/session.ts';
import { createJobService, type JobService } from '../../../services/jobs/job-service.ts';
import { silentLogger } from '../../../services/workspace/test-support.ts';
import { createHttpApp } from '../create-http-app.ts';

const PORT = 50237;
const TOKEN = 'test-token-jobs';
const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
  'content-type': 'application/json',
};

let app: FastifyInstance;
let jobService: JobService;
let jobId: string;

beforeEach(async () => {
  jobService = createJobService({ system: { now: () => new Date() }, logger: silentLogger });
  app = await createHttpApp({
    logLevel: 'silent',
    security: { port: PORT, sessionToken: TOKEN, trustedOrigins: [] },
    getSessionInfo: createSessionInfoProvider({
      version: '1.0.0',
      platform: 'linux',
      features: [],
      readProject: () => ({ state: 'none' }),
    }),
    jobRoutes: { jobService },
  });
  // Runs until it is cancelled, like a long `pnpm install`.
  const started = jobService.start('project.install', 'jobs:install.running', async (ctx) => {
    await new Promise<void>((resolve) => {
      ctx.signal.addEventListener('abort', () => {
        resolve();
      });
    });
    return ok(undefined);
  });
  jobId = started.ok ? started.value.jobId : '';
});

afterEach(async () => {
  jobService.cancelKind('project.install');
  await app.close();
});

const get = (url: string) => app.inject({ method: 'GET', url, headers: HEADERS });
const post = (url: string) => app.inject({ method: 'POST', url, headers: HEADERS, payload: {} });

describe('job endpoints [SPEC-03 4.2]', () => {
  it('GET /jobs/:id returns the status of a running job', async () => {
    const res = await get(`/api/v1/jobs/${jobId}`);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      data: { id: jobId, kind: 'project.install', state: 'running' },
    });
  });

  it('GET /jobs/:id of an unknown job is E015', async () => {
    const res = await get('/api/v1/jobs/nope');

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'E015' } });
  });

  it('POST /jobs/:id/cancel answers 202 and the job ends cancelled', async () => {
    const res = await post(`/api/v1/jobs/${jobId}/cancel`);

    expect(res.statusCode).toBe(202);
    await vi.waitFor(async () => {
      expect((await get(`/api/v1/jobs/${jobId}`)).json()).toMatchObject({
        data: { state: 'cancelled' },
      });
    });
  });
});
