import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createNodeFileSystem } from '../../../adapters/fs/node-file-system.ts';
import type { ProjectService } from '../../../core/project/project-service.ts';
import { err, ok } from '../../../core/shared/result.ts';
import { createSessionInfoProvider } from '../../../core/shared/session.ts';
import { createHttpApp } from '../create-http-app.ts';

const PORT = 50239;
const TOKEN = 'test-token-project-files';
const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
  'content-type': 'application/json',
};

const ErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
  }),
});

function readErrorCode(body: string): string {
  const parsed = ErrorBodySchema.safeParse(JSON.parse(body));
  return parsed.success ? parsed.data.error.code : '';
}

describe('project files routes [WP-4.00]', () => {
  let app: FastifyInstance;
  let isOpen = false;
  const fs = createNodeFileSystem('linux');

  const mockProjectInfo = {
    id: 'proj000001',
    name: 'Test',
    root: '/workspace',
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
    frames: [],
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
    state: () => (isOpen ? { status: 'none' } : { status: 'none' }),
    probe: () => Promise.resolve(ok({ kind: 'empty' })),
    open: () => Promise.resolve(ok(mockProjectInfo)),
    create: () => Promise.resolve(ok(mockProjectInfo)),
    close: () => Promise.resolve(),
    getProjectInfo: () =>
      isOpen ? ok(mockProjectInfo) : err({ code: 'E021', params: { missing: 'project' } }),
    patchProject: () => Promise.resolve(ok(mockProjectInfo)),
    setTrusted: () => Promise.resolve(ok(mockProjectInfo)),
    install: () => Promise.resolve(ok({ jobId: 'j1' })),
    pages: () =>
      Promise.resolve(
        ok({
          pages: [],
          convention: false,
          router: { status: 'none', hasRouterPackage: false },
        }),
      ),
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
    addPage: () => Promise.resolve(ok({ changed: true, files: [], locs: [] })),
    renamePage: () => Promise.resolve(ok({ changed: true, files: [], locs: [] })),
    deletePage: () => Promise.resolve(ok({ changed: true, files: [], locs: [] })),
    extractComponent: () => Promise.resolve(ok({ changed: true, files: [], locs: [] })),
    dirs: () => Promise.resolve(ok([])),
    listDrafts: () => Promise.resolve(ok({ drafts: [], dir: 'drafts', ignored: false })),
    createDraft: () => Promise.resolve(ok({ changed: true, files: [], locs: [] })),
    renameDraft: () => Promise.resolve(ok({ changed: true, files: [], locs: [] })),
    duplicateDraft: () => Promise.resolve(ok({ changed: true, files: [], locs: [] })),
    deleteDraft: () => Promise.resolve(ok({ changed: true, files: [], locs: [] })),
    promoteDraft: () => Promise.resolve(ok({ changed: true, files: [], locs: [] })),
    addBackend: () =>
      Promise.resolve(
        ok({
          id: 'b1',
          path: '/b1',
          label: 'b1',
          status: 'ok' as const,
          resolvedPath: '/b1',
          outsideParent: false,
        }),
      ),
    removeBackend: () => Promise.resolve(ok(undefined)),
    reloadWorkspaceFile: () => Promise.resolve(),
  };

  beforeEach(async () => {
    isOpen = false;
    const session = createSessionInfoProvider({
      version: '1.0.0',
      platform: 'linux',
      features: [],
      readProject: () => ({
        state: isOpen ? 'open' : 'none',
        id: 'proj000001',
        name: 'Test',
        trusted: true,
      }),
    });

    app = await createHttpApp({
      logLevel: 'silent',
      security: { port: PORT, sessionToken: TOKEN, trustedOrigins: [] },
      getSessionInfo: () => session(),
      projectRoutes: {
        projectService: mockProjectService,
        getSessionInfo: () => session(),
        fs,
      },
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('[WP-4.00] project files routes: returns E021 when no project is open', async () => {
    isOpen = false;

    // 1. GET /project/tree
    const treeRes = await app.inject({
      method: 'GET',
      url: '/api/v1/project/tree',
      headers: HEADERS,
    });
    expect(treeRes.statusCode).toBe(409);
    expect(readErrorCode(treeRes.body)).toBe('E021');

    // 2. POST /project/files
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/project/files',
      headers: HEADERS,
      body: JSON.stringify({ path: 'src/A.tsx', kind: 'file' }),
    });
    expect(createRes.statusCode).toBe(409);
    expect(readErrorCode(createRes.body)).toBe('E021');

    // 3. POST /project/files/rename
    const renameRes = await app.inject({
      method: 'POST',
      url: '/api/v1/project/files/rename',
      headers: HEADERS,
      body: JSON.stringify({ from: 'src/A.tsx', to: 'src/B.tsx' }),
    });
    expect(renameRes.statusCode).toBe(409);
    expect(readErrorCode(renameRes.body)).toBe('E021');

    // 4. DELETE /project/files
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/project/files',
      headers: HEADERS,
      body: JSON.stringify({ path: 'src/A.tsx' }),
    });
    expect(delRes.statusCode).toBe(409);
    expect(readErrorCode(delRes.body)).toBe('E021');

    // 5. GET /project/files/importers
    const impRes = await app.inject({
      method: 'GET',
      url: '/api/v1/project/files/importers?path=src/A.tsx',
      headers: HEADERS,
    });
    expect(impRes.statusCode).toBe(409);
    expect(readErrorCode(impRes.body)).toBe('E021');
  });

  it('[WP-4.00] project files routes: returns E016 when input schema is invalid', async () => {
    isOpen = true;

    // 1. GET /project/tree with invalid query
    const treeRes = await app.inject({
      method: 'GET',
      url: `/api/v1/project/tree?dir=${'a'.repeat(2000)}`,
      headers: HEADERS,
    });
    expect(treeRes.statusCode).toBe(400);
    expect(readErrorCode(treeRes.body)).toBe('E016');

    // 2. POST /project/files with invalid body (missing kind, invalid path)
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/project/files',
      headers: HEADERS,
      body: JSON.stringify({ path: '/illegal.tsx' }),
    });
    expect(createRes.statusCode).toBe(400);
    expect(readErrorCode(createRes.body)).toBe('E016');

    // 3. POST /project/files/rename with invalid body (missing to)
    const renameRes = await app.inject({
      method: 'POST',
      url: '/api/v1/project/files/rename',
      headers: HEADERS,
      body: JSON.stringify({ from: 'src/A.tsx' }),
    });
    expect(renameRes.statusCode).toBe(400);
    expect(readErrorCode(renameRes.body)).toBe('E016');

    // 4. DELETE /project/files with invalid body (empty body)
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/project/files',
      headers: HEADERS,
      body: JSON.stringify({}),
    });
    expect(delRes.statusCode).toBe(400);
    expect(readErrorCode(delRes.body)).toBe('E016');

    // 5. GET /project/files/importers with invalid path
    const impRes = await app.inject({
      method: 'GET',
      url: '/api/v1/project/files/importers?path=/absolute/path',
      headers: HEADERS,
    });
    expect(impRes.statusCode).toBe(400);
    expect(readErrorCode(impRes.body)).toBe('E016');
  });
});
