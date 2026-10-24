// The recent projects endpoint (R-PJ-25).
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../../../core/workspace/test-support.ts';
import { registerRecentProjectRoutes } from './project-recent.ts';

describe('GET /project/recent [R-PJ-25]', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'rc-recent-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('lists the recent projects that still have a workspace.json, newest first', async () => {
    const kept = join(dir, 'shop');
    await mkdir(join(kept, '.kumicraft'), { recursive: true });
    await writeFile(join(kept, '.kumicraft', 'workspace.json'), '{}');
    const app = Fastify();
    registerRecentProjectRoutes(app, {
      fs: nodeFs,
      recents: {
        recentProjects: () => [
          { path: join(dir, 'gone'), name: 'Gone', openedAt: '2026-10-24T02:00:00.000Z' },
          { path: kept, name: 'Shop', openedAt: '2026-10-24T01:00:00.000Z' },
        ],
      },
    });

    const res = await app.inject({ method: 'GET', url: '/project/recent' });

    expect(res.json()).toEqual({
      data: [{ path: kept, name: 'Shop', openedAt: '2026-10-24T01:00:00.000Z' }],
    });
    await app.close();
  });
});
