// Route test for GET /project/assets [R-DT-13].
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { ProjectInfo } from '@reactcraft/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ProjectService } from '../../../core/project/project-service.ts';
import { err, ok } from '../../../core/shared/result.ts';
import { createSessionInfoProvider } from '../../../core/shared/session.ts';
import { directWriteFs } from '../../../core/workspace/test-support.ts';
import { createHttpApp } from '../create-http-app.ts';

const PORT = 50238;
const TOKEN = 'test-token-assets';
const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
};

describe('GET /project/assets [R-DT-13]', () => {
  let tmpDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-assets-route-'));

    // Populate public/ files matching scenario #5
    await fs.mkdir(path.join(tmpDir, 'public/images'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'public/.hidden'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'public/node_modules'), { recursive: true });

    await fs.writeFile(path.join(tmpDir, 'public/a.png'), 'a');
    await fs.writeFile(path.join(tmpDir, 'public/images/b.svg'), '<svg></svg>');
    await fs.writeFile(path.join(tmpDir, 'public/x.txt'), 'text');
    await fs.writeFile(path.join(tmpDir, 'public/.hidden/c.png'), 'hidden');
    await fs.writeFile(path.join(tmpDir, 'public/node_modules/d.png'), 'node_modules');

    const projectInfo: ProjectInfo = {
      id: 'test000001',
      name: 'Test',
      root: tmpDir,
      sourceDir: 'src',
      support: {
        supported: true,
        reasons: [],
        framework: 'vite-react',
        versions: {},
        language: 'ts',
      },
      needsInstall: false,
      responsiveMode: 'desktop-first',
      frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
      primaryFrameId: 'desktop',
      backends: [],
      trusted: true,
      designDirs: {
        pages: 'src/pages',
        layouts: 'src/layouts',
        components: 'src/components',
      },
    };

    const mockProjectService: ProjectService = {
      state: () => ({
        status: 'open',
        root: tmpDir,
        file: {
          schemaVersion: 2,
          id: 'test000001',
          name: 'Test',
          createdAt: '2026-01-01T00:00:00.000Z',
          framework: 'vite-react',
          sourceDir: 'src',
          backends: [],
          responsiveMode: 'desktop-first',
          frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
          primaryFrameId: 'desktop',
        },
        support: projectInfo.support,
        trusted: true,
        needsInstall: false,
        backends: [],
      }),
      probe: () => Promise.resolve(ok({ kind: 'empty' })),
      open: () => Promise.resolve(ok(projectInfo)),
      create: () => Promise.resolve(ok(projectInfo)),
      close: () => Promise.resolve(),
      getProjectInfo: () => ok(projectInfo),
      patchProject: () => Promise.resolve(ok(projectInfo)),
      setTrusted: () => Promise.resolve(ok(projectInfo)),
      install: () => Promise.resolve(ok({ jobId: 'job1' })),
      theme: () =>
        Promise.resolve(
          ok({
            colors: [],
            fontSizes: [],
            radii: [],
            fonts: [],
            shadows: [],
            breakpoints: [],
          }),
        ),
      editTheme: () =>
        Promise.resolve(
          ok({
            colors: [],
            fontSizes: [],
            radii: [],
            fonts: [],
            shadows: [],
            breakpoints: [],
          }),
        ),
      themeUsage: () => Promise.resolve(ok({ count: 0 })),
      addBackend: () => Promise.resolve(err({ code: 'E021', params: { missing: 'project' } })),
      removeBackend: () => Promise.resolve(ok(undefined)),
      reloadWorkspaceFile: () => Promise.resolve(),
      pages: () => Promise.resolve(ok({ convention: true, pages: [] })),
      addPage: () => Promise.resolve(ok({ changed: true, files: [], locs: [] })),
      renamePage: () => Promise.resolve(ok({ changed: true, files: [], locs: [] })),
      deletePage: () => Promise.resolve(ok({ changed: true, files: [], locs: [] })),
      extractComponent: () => Promise.resolve(ok({ changed: true, files: [], locs: [] })),
      dirs: () => Promise.resolve(ok([])),
      listDrafts: () => Promise.resolve(ok({ drafts: [], dir: 'src/drafts', ignored: false })),
      createDraft: () => Promise.resolve(ok({ changed: true, files: [], locs: [], draftFile: '' })),
      renameDraft: () => Promise.resolve(ok({ changed: true, files: [], locs: [], draftFile: '' })),
      duplicateDraft: () =>
        Promise.resolve(ok({ changed: true, files: [], locs: [], draftFile: '' })),
      deleteDraft: () => Promise.resolve(ok({ changed: true, files: [], locs: [] })),
      promoteDraft: () => Promise.resolve(ok({ changed: true, files: [], locs: [], pagePath: '' })),
    };

    const getSessionInfo = createSessionInfoProvider({
      version: '1.0.0',
      platform: 'linux',
      features: [],
      readProject: () => ({
        state: 'open',
        id: 'test000001',
        name: 'Test',
        trusted: true,
      }),
    });
    app = await createHttpApp({
      logLevel: 'silent',
      security: { port: PORT, sessionToken: TOKEN, trustedOrigins: [] },
      getSessionInfo,
      projectRoutes: {
        projectService: mockProjectService,
        getSessionInfo,
        fs: directWriteFs,
      },
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('#12 GET /project/assets returns 200 with public image files matching scenario #5 [R-DT-13]', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/project/assets',
      headers: HEADERS,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { files: ['public/a.png', 'public/images/b.svg'] } });
  });
});
