import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { DirectoryListing } from '@kumicraft/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSessionInfoProvider } from '../../../core/shared/session.ts';
import { makeTempDir, nodeFs } from '../../../core/workspace/test-support.ts';
import { createHttpApp } from '../create-http-app.ts';

const PORT = 50237;
const TOKEN = 'test-token-fs';
const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
  'content-type': 'application/json',
};

let app: FastifyInstance;
let temp: { dir: string; cleanup: () => Promise<void> };

beforeEach(async () => {
  temp = await makeTempDir();
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
    fsRoutes: { fs: nodeFs, platform: 'linux', homeDir: temp.dir },
  });
});

afterEach(async () => {
  await app.close();
  await temp.cleanup();
});

const get = (url: string) => app.inject({ method: 'GET', url, headers: HEADERS });

describe('GET /api/v1/fs/directories [S-27]', () => {
  it('lists only visible subdirectories and identifies projects', async () => {
    // Setup directories
    await mkdir(join(temp.dir, 'project-a'));
    await writeFile(join(temp.dir, 'project-a', 'package.json'), '{}');

    await mkdir(join(temp.dir, 'folder-b'));
    await writeFile(join(temp.dir, 'some-file.txt'), 'hello');
    await mkdir(join(temp.dir, '.hidden-folder'));

    const res = await get(`/api/v1/fs/directories?path=${encodeURIComponent(temp.dir)}`);
    expect(res.statusCode).toBe(200);

    const body = res.json<{ data: DirectoryListing }>().data;
    expect(body.entries).toHaveLength(2);

    const names = body.entries.map((e) => e.name).sort();
    expect(names).toEqual(['folder-b', 'project-a']);

    const projA = body.entries.find((e) => e.name === 'project-a');
    expect(projA?.isProject).toBe(true);

    const folderB = body.entries.find((e) => e.name === 'folder-b');
    expect(folderB?.isProject).toBe(false);
  });

  it('rejects path containing control characters [S-20]', async () => {
    const res = await get(`/api/v1/fs/directories?path=${encodeURIComponent(temp.dir + '\0')}`);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: { code: 'E012' } });
  });
});
