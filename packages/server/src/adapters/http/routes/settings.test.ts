import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSessionInfoProvider } from '../../../core/shared/session.ts';
import { CONFIG_FILE, createConfigStore } from '../../../core/shared/user-config.ts';
import {
  makeTempDir,
  nodeFs,
  platform,
  silentLogger,
} from '../../../core/workspace/test-support.ts';
import { createHttpApp } from '../create-http-app.ts';

const PORT = 50235;
const TOKEN = 'test-token-settings';
const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
  'content-type': 'application/json',
};

let app: FastifyInstance;
let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
  const config = await createConfigStore({
    fs: nodeFs,
    dir,
    platform,
    env: { OPENAI_API_KEY: 'sk-env-secret' },
    logger: silentLogger,
  });
  app = await createHttpApp({
    logLevel: 'silent',
    security: { port: PORT, sessionToken: TOKEN, trustedOrigins: [] },
    getSessionInfo: createSessionInfoProvider({
      version: '1.0.0',
      platform,
      features: [],
      readWorkspace: () => ({ state: 'none', directory: dir }),
    }),
    settingsRoutes: { config },
  });
});

afterEach(async () => {
  await app.close();
  await cleanup();
});

const patch = (payload: unknown) =>
  app.inject({
    method: 'PATCH',
    url: '/api/v1/settings',
    headers: HEADERS,
    payload: payload as object,
  });

describe('/api/v1/settings', () => {
  it('returns the settings with key statuses only', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/settings', headers: HEADERS });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      data: {
        ai: { keys: { openai: 'fromEnv', anthropic: 'missing' } },
        export: { typecheck: true },
      },
    });
    expect(res.body).not.toContain('sk-env-secret');
  });

  it('saves a patch to config.json and returns the merged settings', async () => {
    const res = await patch({ language: 'vi', export: { buildCheck: true } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      data: { language: 'vi', export: { typecheck: true, buildCheck: true } },
    });
    expect(JSON.parse(await readFile(join(dir, CONFIG_FILE), 'utf8'))).toMatchObject({
      language: 'vi',
    });
  });

  it('rejects unknown fields and invalid values with E016', async () => {
    for (const payload of [
      { language: 'fr' },
      { theme: 'dark' },
      { ai: { keys: { openai: 'x' } } },
    ]) {
      const res = await patch(payload);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'E016' } });
    }
  });

  it('requires the session token [S-01]', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
      headers: { host: HEADERS.host },
    });

    expect(res.statusCode).toBe(401);
  });
});
