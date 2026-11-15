// Route test for GET /project/assets [R-DT-13].
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { ProjectInfo } from '@kumicraft/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { viteReactAdapter } from '../../../core/project/frameworks/vite-react/index.ts';
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
        pages: ['src/pages'],
        layouts: ['src/layouts'],
        components: ['src/components'],
        drafts: 'src/drafts',
      },
    };

    const mockProjectService: ProjectService = {
      getAdapter: () => viteReactAdapter,
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
      pages: () =>
        Promise.resolve(
          ok({
            convention: true,
            routesFile: 'src/routes.tsx',
            router: {
              status: 'found',
              file: 'src/routes.tsx',
              line: 1,
              kind: 'dataRouter',
              chosen: false,
            },
            pages: [],
          }),
        ),
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

  it('serves a public image to the picker as bytes of its real type [R-DT-13] (tour 01)', async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    await fs.writeFile(path.join(tmpDir, 'public/real.png'), png);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/project/assets/file?path=public%2Freal.png',
      headers: HEADERS,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(Uint8Array.from(res.rawPayload)).toEqual(png);
  });

  it('refuses what is not a public image: a text file named .png, a path outside public/ [R-DT-13] (tour 01)', async () => {
    for (const url of [
      '/api/v1/project/assets/file?path=public%2Fa.png',
      '/api/v1/project/assets/file?path=public%2F..%2Fsrc%2Fmain.png',
      '/api/v1/project/assets/file?path=src%2Fa.png',
      '/api/v1/project/assets/file?path=public%2Fx.txt',
    ]) {
      const res = await app.inject({ method: 'GET', url, headers: HEADERS });
      expect(res.statusCode, url).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'E016' } });
    }
  });
});
