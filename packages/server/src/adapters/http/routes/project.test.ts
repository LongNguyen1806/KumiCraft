import type { ProjectInfo, ProjectProbe, ThemeInfo, WorkspaceFile } from '@reactcraft/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ProjectService } from '../../../core/project/project-service.ts';
import { err, ok } from '../../../core/shared/result.ts';
import { createSessionInfoProvider } from '../../../core/shared/session.ts';
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

const projectInfo = {
  id: 'shop000001',
  name: 'Shop',
  root: '/projects/shop',
  sourceDir: 'src',
  support: {
    supported: true,
    reasons: [],
    framework: 'vite-react' as const,
    versions: {},
    language: 'ts' as const,
  },
  needsInstall: false,
  responsiveMode: 'desktop-first' as const,
  frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
  primaryFrameId: 'desktop',
  backends: [],
  trusted: false,
  designDirs: {
    pages: 'src/pages',
    layouts: 'src/layouts',
    components: 'src/components',
  },
};

const mockWorkspaceFile: WorkspaceFile = {
  schemaVersion: 2,
  id: 'shop000001',
  name: 'Shop',
  createdAt: '2026-01-01T00:00:00.000Z',
  framework: 'vite-react',
  sourceDir: 'src',
  backends: [],
  responsiveMode: 'desktop-first',
  frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
  primaryFrameId: 'desktop',
};

const mockProjectService: ProjectService = {
  state: () =>
    isOpen
      ? {
          status: 'open',
          root: '/projects/shop',
          file: mockWorkspaceFile,
          support: projectInfo.support,
          trusted: trusted ?? false,
          needsInstall: false,
          backends: [],
        }
      : { status: 'none' },
  probe: (path) =>
    Promise.resolve(
      path.includes('missing') ? ok({ kind: 'missing', canCreate: true }) : ok({ kind: 'empty' }),
    ),
  open: () => Promise.resolve(ok(projectInfo)),
  create: () => Promise.resolve(ok(projectInfo)),
  close: () => {
    isOpen = false;
    return Promise.resolve();
  },
  getProjectInfo: () =>
    isOpen ? ok(projectInfo) : err({ code: 'E021', params: { missing: 'project' } }),
  patchProject: (updates) =>
    Promise.resolve(
      ok({
        ...projectInfo,
        name: updates.name ?? projectInfo.name,
        responsiveMode: updates.responsiveMode ?? projectInfo.responsiveMode,
        frames: updates.frames ?? projectInfo.frames,
        primaryFrameId: updates.primaryFrameId ?? projectInfo.primaryFrameId,
      }),
    ),
  setTrusted: (val) => {
    if (!isOpen) return Promise.resolve(err({ code: 'E021', params: { missing: 'project' } }));
    trusted = val;
    return Promise.resolve(ok({ ...projectInfo, trusted: val }));
  },
  install: () => Promise.resolve(ok({ jobId: 'job000000001' })),
  theme: () =>
    Promise.resolve(
      ok({
        colors: [{ name: 'brand', value: '#3b82f6' }],
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
        colors: [{ name: 'brand', value: '#3b82f6' }],
        fontSizes: [],
        radii: [],
        fonts: [],
        shadows: [],
        breakpoints: [],
      }),
    ),
  themeUsage: () => Promise.resolve(ok({ count: 0 })),
  addBackend: (path, label) =>
    Promise.resolve(
      ok({
        id: 'back000001',
        path,
        label: label ?? 'backend',
        status: 'ok',
        resolvedPath: path,
        outsideParent: false,
      }),
    ),
  removeBackend: () => Promise.resolve(ok(undefined)),
  reloadWorkspaceFile: () => Promise.resolve(),
  pages: () =>
    Promise.resolve(
      ok({ convention: true, pages: [{ path: '/', component: 'Home', dynamic: false }] }),
    ),
  addPage: () =>
    Promise.resolve(
      ok({ changed: true, files: ['src/routes.tsx', 'src/pages/About.tsx'], locs: [] }),
    ),
  renamePage: () => Promise.resolve(ok({ changed: true, files: ['src/routes.tsx'], locs: [] })),
  deletePage: () => Promise.resolve(ok({ changed: true, files: ['src/routes.tsx'], locs: [] })),
  extractComponent: () =>
    Promise.resolve(
      ok({ changed: true, files: ['src/pages/Home.tsx', 'src/components/PromoBox.tsx'], locs: [] }),
    ),
  dirs: () => Promise.resolve(ok(['src/pages', 'src/components'])),
  listDrafts: () =>
    Promise.resolve(
      ok({
        drafts: [{ name: 'BanNhap1', file: 'src/drafts/BanNhap1.tsx', free: false, inUse: false }],
        dir: 'src/drafts',
        ignored: false,
      }),
    ),
  createDraft: () =>
    Promise.resolve(
      ok({
        changed: true,
        files: ['src/drafts/BanNhap1.tsx'],
        locs: [],
        draftFile: 'src/drafts/BanNhap1.tsx',
      }),
    ),
  renameDraft: () =>
    Promise.resolve(
      ok({
        changed: true,
        files: ['src/drafts/BanNhap1.tsx', 'src/drafts/Mockup.tsx'],
        locs: [],
        draftFile: 'src/drafts/Mockup.tsx',
      }),
    ),
  duplicateDraft: () =>
    Promise.resolve(
      ok({
        changed: true,
        files: ['src/drafts/BanNhap2.tsx'],
        locs: [],
        draftFile: 'src/drafts/BanNhap2.tsx',
      }),
    ),
  deleteDraft: () =>
    Promise.resolve(ok({ changed: true, files: ['src/drafts/BanNhap1.tsx'], locs: [] })),
  promoteDraft: () =>
    Promise.resolve(
      ok({
        changed: true,
        files: ['src/routes.tsx', 'src/pages/KhuyenMai.tsx'],
        locs: [],
        pagePath: '/khuyen-mai',
      }),
    ),
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
    projectRoutes: { projectService: mockProjectService, getSessionInfo },
  });
});

afterEach(async () => {
  await app.close();
});

const post = (url: string, payload: unknown, headers: Record<string, string> = HEADERS) =>
  app.inject({ method: 'POST', url, headers, payload: payload as object });

const get = (url: string, headers: Record<string, string> = HEADERS) =>
  app.inject({ method: 'GET', url, headers });

describe('POST /api/v1/project/trust', () => {
  it('saves the decision and returns the new session [S-80]', async () => {
    const res = await post('/api/v1/project/trust', { trusted: true });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ data: { project: { state: 'open', trusted: true } } });
  });

  it('rejects a payload that is not { trusted: boolean } with E016', async () => {
    for (const payload of [{}, { trusted: 'yes' }, { trusted: true, extra: 1 }]) {
      const res = await post('/api/v1/project/trust', payload);

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'E016' } });
    }
  });

  it('answers E021 when no project is open', async () => {
    isOpen = false;

    const res = await post('/api/v1/project/trust', { trusted: true });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: 'E021', params: { missing: 'project' } } });
  });

  it('requires the session token [S-07]', async () => {
    const res = await post(
      '/api/v1/project/trust',
      { trusted: true },
      { host: HEADERS.host, 'content-type': 'application/json' },
    );

    expect(res.statusCode).toBe(401);
    expect(trusted).toBeUndefined();
  });
});

describe('GET /api/v1/project/probe', () => {
  it('returns probe information for a valid path', async () => {
    const res = await get('/api/v1/project/probe?path=/some/missing/dir');
    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: ProjectProbe }>().data).toEqual({ kind: 'missing', canCreate: true });
  });

  it('returns 400 E016 if path is missing', async () => {
    const res = await get('/api/v1/project/probe');
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/v1/project/open', () => {
  it('opens project and returns ProjectInfo', async () => {
    const res = await post('/api/v1/project/open', { path: '/projects/shop' });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: ProjectInfo }>().data).toMatchObject({
      id: 'shop000001',
      name: 'Shop',
    });
  });
});

describe('POST /api/v1/project/create', () => {
  it('creates project and returns 201 ProjectInfo', async () => {
    const res = await post('/api/v1/project/create', { path: '/projects/new', name: 'New App' });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ data: ProjectInfo }>().data).toMatchObject({ id: 'shop000001' });
  });
});

describe('GET /api/v1/project/theme', () => {
  it('returns theme tokens', async () => {
    const res = await get('/api/v1/project/theme');
    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: ThemeInfo }>().data.colors).toEqual([
      { name: 'brand', value: '#3b82f6' },
    ]);
  });
});

describe('POST /api/v1/project/install', () => {
  it('answers 202 with the id of the install job [R-PJ-13]', async () => {
    const res = await post('/api/v1/project/install', { command: ['pnpm', 'install'] });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ data: { jobId: 'job000000001' } });
  });
});

describe('Page routes: /api/v1/project/dirs and /api/v1/project/pages', () => {
  it('GET /api/v1/project/dirs returns directory list', async () => {
    const res = await get('/api/v1/project/dirs');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { dirs: ['src/pages', 'src/components'] } });
  });

  it('POST /api/v1/project/pages creates a new page', async () => {
    const res = await post('/api/v1/project/pages', { name: 'Giới thiệu' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      data: { changed: true, files: ['src/routes.tsx', 'src/pages/About.tsx'], locs: [] },
    });
  });

  it('PATCH /api/v1/project/pages renames a page', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/project/pages',
      headers: HEADERS,
      payload: { path: '/about', newName: 'Company' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { changed: true, files: ['src/routes.tsx'], locs: [] } });
  });

  it('DELETE /api/v1/project/pages deletes a page', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/project/pages',
      headers: HEADERS,
      payload: { path: '/about' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { changed: true, files: ['src/routes.tsx'], locs: [] } });
  });

  it('[R-CP-12] GET /api/v1/project/components returns E021 when no project is opened', async () => {
    isOpen = false;
    const res = await get('/api/v1/project/components');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: 'E021' } });
  });

  it('[R-CP-14] POST /api/v1/project/components/extract extracts component and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/project/components/extract',
      headers: HEADERS,
      payload: {
        loc: 'src/pages/Home.tsx:10:4',
        tag: 'section',
        name: 'Promo Box',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      data: {
        changed: true,
        files: ['src/pages/Home.tsx', 'src/components/PromoBox.tsx'],
        locs: [],
      },
    });
  });

  it('[R-CP-14] POST /api/v1/project/components/extract returns E021 when no project is opened', async () => {
    isOpen = false;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/project/components/extract',
      headers: HEADERS,
      payload: {
        loc: 'src/pages/Home.tsx:10:4',
        tag: 'section',
        name: 'Promo Box',
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: 'E021' } });
  });

  it('handles draft routes', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/project/drafts',
      headers: HEADERS,
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toEqual({
      data: {
        drafts: [{ name: 'BanNhap1', file: 'src/drafts/BanNhap1.tsx', free: false, inUse: false }],
        dir: 'src/drafts',
        ignored: false,
      },
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/project/drafts',
      headers: HEADERS,
      payload: { free: false },
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.json()).toMatchObject({
      data: { draftFile: 'src/drafts/BanNhap1.tsx' },
    });
  });
});
