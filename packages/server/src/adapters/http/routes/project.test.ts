import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { err, ok } from '../../../core/shared/result.ts';
import { createSessionInfoProvider } from '../../../core/shared/session.ts';
import type { WorkspaceService } from '../../../core/workspace/workspace-service.ts';
import { createHttpApp } from '../create-http-app.ts';

const PORT = 50236;
const TOKEN = 'test-token-project';
const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
  'content-type': 'application/json',
};

let app: FastifyInstance;
let trusted: boolean | undefined;
let isOpen: boolean;

const workspaceService: Pick<WorkspaceService, 'setTrusted'> = {
  setTrusted: (value) => {
    if (!isOpen) return Promise.resolve(err({ code: 'E021', params: { missing: 'project' } }));
    trusted = value;
    return Promise.resolve(ok({ status: 'none' }));
  },
};

beforeEach(async () => {
  trusted = undefined;
  isOpen = true;
  const getSessionInfo = createSessionInfoProvider({
    version: '1.0.0',
    platform: 'linux',
    features: [],
    readProject: () => ({
      state: 'open',
      id: 'shop000001',
      name: 'Shop',
      trusted: trusted ?? false,
    }),
  });
  app = await createHttpApp({
    logLevel: 'silent',
    security: { port: PORT, sessionToken: TOKEN, trustedOrigins: [] },
    getSessionInfo,
    projectRoutes: { workspaceService, getSessionInfo },
  });
});

afterEach(async () => {
  await app.close();
});

const post = (payload: unknown, headers: Record<string, string> = HEADERS) =>
  app.inject({ method: 'POST', url: '/api/v1/project/trust', headers, payload: payload as object });

describe('POST /api/v1/project/trust', () => {
  it('saves the decision and returns the new session [S-80]', async () => {
    const res = await post({ trusted: true });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ data: { project: { state: 'open', trusted: true } } });
  });

  it('rejects a payload that is not { trusted: boolean } with E016', async () => {
    for (const payload of [{}, { trusted: 'yes' }, { trusted: true, extra: 1 }]) {
      const res = await post(payload);

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'E016' } });
    }
  });

  it('answers E021 when no project is open', async () => {
    isOpen = false;

    const res = await post({ trusted: true });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: 'E021', params: { missing: 'project' } } });
  });

  it('requires the session token [S-07]', async () => {
    const res = await post(
      { trusted: true },
      { host: HEADERS.host, 'content-type': 'application/json' },
    );

    expect(res.statusCode).toBe(401);
    expect(trusted).toBeUndefined();
  });
});
