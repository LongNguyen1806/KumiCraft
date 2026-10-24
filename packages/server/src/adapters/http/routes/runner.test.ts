import type { RunnerStatus } from '@kumicraft/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { RunnerService } from '../../../core/runner/runner-service.ts';
import { err, ok } from '../../../core/shared/result.ts';
import { createSessionInfoProvider } from '../../../core/shared/session.ts';
import { createHttpApp } from '../create-http-app.ts';

const PORT = 50238;
const TOKEN = 'test-token-runner';
const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
  'content-type': 'application/json',
};

let app: FastifyInstance;
let mockRunnerService: RunnerService;
let currentStatus: RunnerStatus;

beforeEach(async () => {
  currentStatus = { state: 'stopped' };
  mockRunnerService = {
    getStatus: () => currentStatus,
    start: () => {
      currentStatus = {
        state: 'starting',
        origin: 'http://127.0.0.1:52000',
        nonce: 'nonce-123',
        startedAt: '2026-10-14T00:00:00.000Z',
      };
      return Promise.resolve(ok(currentStatus));
    },
    restart: () => {
      currentStatus = {
        state: 'starting',
        origin: 'http://127.0.0.1:52001',
        nonce: 'nonce-456',
        startedAt: '2026-10-14T00:00:01.000Z',
      };
      return Promise.resolve(ok(currentStatus));
    },
    stop: () => {
      currentStatus = { state: 'stopped' };
      return Promise.resolve(ok(currentStatus));
    },
    dispose: () => Promise.resolve(),
  };

  const getSessionInfo = createSessionInfoProvider({
    version: '1.0.0',
    platform: 'linux',
    features: [],
    readProject: () => ({ state: 'none' }),
  });

  app = await createHttpApp({
    logLevel: 'silent',
    security: { port: PORT, sessionToken: TOKEN, trustedOrigins: [] },
    getSessionInfo,
    runnerRoutes: { runnerService: mockRunnerService },
  });
});

afterEach(async () => {
  await app.close();
});

const get = (url: string) => app.inject({ method: 'GET', url, headers: HEADERS });
const post = (url: string) => app.inject({ method: 'POST', url, headers: HEADERS });

describe('Runner HTTP endpoints [SPEC-03 section 5.4]', () => {
  it('GET /api/v1/runner returns 200 with current RunnerStatus', async () => {
    const res = await get('/api/v1/runner');
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: RunnerStatus }>().data;
    expect(body.state).toBe('stopped');
  });

  it('POST /api/v1/runner/start returns 202 with starting status', async () => {
    const res = await post('/api/v1/runner/start');
    expect(res.statusCode).toBe(202);
    const body = res.json<{ data: RunnerStatus }>().data;
    expect(body.state).toBe('starting');
    expect(body.origin).toBe('http://127.0.0.1:52000');
    expect(body.nonce).toBe('nonce-123');
  });

  it('POST /api/v1/runner/start returns mapped error code on failure [E011, E021, E025]', async () => {
    mockRunnerService.start = () =>
      Promise.resolve(err({ code: 'E011', params: { reason: 'untrusted' } }));

    const res = await post('/api/v1/runner/start');
    expect(res.statusCode).toBe(403);
    const body = res.json<{ error: { code: string; params: { reason: string } } }>();
    expect(body.error.code).toBe('E011');
    expect(body.error.params.reason).toBe('untrusted');
  });

  it('POST /api/v1/runner/restart returns 202 with fresh status', async () => {
    const res = await post('/api/v1/runner/restart');
    expect(res.statusCode).toBe(202);
    const body = res.json<{ data: RunnerStatus }>().data;
    expect(body.state).toBe('starting');
    expect(body.origin).toBe('http://127.0.0.1:52001');
    expect(body.nonce).toBe('nonce-456');
  });

  it('POST /api/v1/runner/stop returns 200 with stopped status', async () => {
    const res = await post('/api/v1/runner/stop');
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: RunnerStatus }>().data;
    expect(body.state).toBe('stopped');
  });

  it('rejects unauthenticated requests with 401 [E014]', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/runner',
      headers: { host: `127.0.0.1:${String(PORT)}` },
    });
    expect(res.statusCode).toBe(401);
  });
});
