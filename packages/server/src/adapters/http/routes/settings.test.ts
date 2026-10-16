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
    logger: silentLogger,
  });
  app = await createHttpApp({
    logLevel: 'silent',
    security: { port: PORT, sessionToken: TOKEN, trustedOrigins: [] },
    getSessionInfo: createSessionInfoProvider({
      version: '1.0.0',
      platform,
      features: [],
      readProject: () => ({ state: 'none', suggestedPath: dir }),
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
  it('returns the settings, never an API key [V-108]', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/settings', headers: HEADERS });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { editor: 'vscode', agent: { preferred: 'auto' } } });
  });

  it('saves a patch to config.json and returns the merged settings', async () => {
    const res = await patch({ language: 'vi', packageManager: 'npm' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      data: { language: 'vi', editor: 'vscode', packageManager: 'npm' },
    });
    expect(JSON.parse(await readFile(join(dir, CONFIG_FILE), 'utf8'))).toMatchObject({
      language: 'vi',
    });
  });

  it('rejects unknown fields and invalid values with E016', async () => {
    for (const payload of [
      { language: 'fr' },
      { theme: 'dark' },
      { editor: 'notepad' },
      { ai: { keys: { openai: 'x' } } },
      { agent: { preferred: 'gpt' } },
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

  it('refuses a body over 10 MB with E016 before parsing [S-87]', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/settings',
      headers: HEADERS,
      payload: '{"x":"' + 'a'.repeat(10 * 1024 * 1024) + '"}',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'E016', params: { reason: 'FST_ERR_CTP_BODY_TOO_LARGE' } },
    });
    expect(await nodeFs.exists(dir, CONFIG_FILE)).toBe(false);
  });
});
