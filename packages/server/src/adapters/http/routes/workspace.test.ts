import type { DesignDocument, OperationBatch } from '@reactcraft/model';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDesignStore, type DesignStore } from '../../../core/design-store/design-store.ts';
import { createSessionInfoProvider } from '../../../core/shared/session.ts';
import { createConfigStore } from '../../../core/shared/user-config.ts';
import {
  fakeSystem,
  makeTempDir,
  nodeFs,
  platform,
  sequenceIds,
  silentLogger,
} from '../../../core/workspace/test-support.ts';
import {
  createWorkspaceService,
  type WorkspaceService,
} from '../../../core/workspace/workspace-service.ts';
import { createHttpApp } from '../create-http-app.ts';

const PORT = 50234;
const TOKEN = 'test-token-workspace';
const HOST = `127.0.0.1:${String(PORT)}`;
const AUTH = {
  authorization: `Bearer ${TOKEN}`,
  host: HOST,
  'content-type': 'application/json',
};

describe('Workspace HTTP Routes (/api/v1/workspace)', () => {
  let app: FastifyInstance;
  let workspaceDir: string;
  let configDir: string;
  let cleanupWs: () => Promise<void>;
  let cleanupConfig: () => Promise<void>;
  let workspaceService: WorkspaceService;
  let currentStore: DesignStore | undefined;

  beforeEach(async () => {
    const wsTemp = await makeTempDir();
    workspaceDir = wsTemp.dir;
    cleanupWs = wsTemp.cleanup;

    const cfgTemp = await makeTempDir();
    configDir = cfgTemp.dir;
    cleanupConfig = cfgTemp.cleanup;

    const system = fakeSystem(1, new Set([1]));

    const configStore = await createConfigStore({
      fs: nodeFs,
      dir: configDir,
      platform,
      env: {},
      logger: silentLogger,
    });

    workspaceService = createWorkspaceService({
      fs: nodeFs,
      root: workspaceDir,
      system,
      config: configStore,
      logger: silentLogger,
      port: PORT,
      newId: sequenceIds(),
    });

    const instantiateStore = (doc: DesignDocument, rev: number): DesignStore =>
      createDesignStore({
        fs: nodeFs,
        root: workspaceDir,
        system,
        logger: silentLogger,
        initialDocument: doc,
        initialRevision: rev,
      });

    const getSessionInfo = createSessionInfoProvider({
      version: '1.0.0',
      platform,
      features: [],
      readWorkspace: () => {
        const state = workspaceService.state();
        if (state.status === 'open') {
          return {
            state: 'open',
            id: state.document.workspace.id,
            name: state.document.workspace.name,
            revision: currentStore ? currentStore.revision() : state.document.workspace.revision,
            trusted: state.trusted,
          };
        }
        return { state: 'none', directory: workspaceDir };
      },
    });

    app = await createHttpApp({
      logLevel: 'silent',
      security: { port: PORT, sessionToken: TOKEN, trustedOrigins: [] },
      getSessionInfo,
      workspaceRoutes: {
        workspaceService,
        getDesignStore: () => currentStore,
        setDesignStore: (store) => {
          currentStore = store;
        },
        createDesignStore: instantiateStore,
        getSessionInfo,
      },
    });
  });

  afterEach(async () => {
    await app.close();
    await workspaceService.close();
    await cleanupWs();
    await cleanupConfig();
  });

  it('GET /workspace/document returns 404 E015 when workspace is not open', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/workspace/document',
      headers: AUTH,
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error?: { code?: string } };
    expect(body.error?.code).toBe('E015');
  });

  it('POST /workspace rejects invalid body with 400 E016', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspace',
      headers: AUTH,
      payload: { name: '' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error?: { code?: string } };
    expect(body.error?.code).toBe('E016');
  });

  it('POST /workspace creates workspace and initializes design store with 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspace',
      headers: AUTH,
      payload: { name: 'My Test Shop' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as {
      data?: { id: string; name: string; revision: number };
    };
    expect(body.data?.name).toBe('My Test Shop');
    expect(body.data?.revision).toBe(0);

    // GET /workspace/document returns the newly created document
    const docRes = await app.inject({
      method: 'GET',
      url: '/api/v1/workspace/document',
      headers: AUTH,
    });
    expect(docRes.statusCode).toBe(200);
    const docBody = JSON.parse(docRes.body) as {
      data?: { document: DesignDocument; revision: number };
    };
    expect(docBody.data?.document.workspace.name).toBe('My Test Shop');
    expect(docBody.data?.revision).toBe(0);
  });

  it('POST /workspace returns 409 E018 when workspace already exists', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/workspace',
      headers: AUTH,
      payload: { name: 'First' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspace',
      headers: AUTH,
      payload: { name: 'Second' },
    });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error?: { code?: string } };
    expect(body.error?.code).toBe('E018');
  });

  it('POST /workspace/operations applies batch and increments revision', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/workspace',
      headers: AUTH,
      payload: { name: 'Initial Name' },
    });

    const batch: OperationBatch = {
      baseRevision: 0,
      ops: [{ op: 'workspace.update', name: 'Updated Name' }],
      meta: { source: 'user', label: 'update name' },
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspace/operations',
      headers: AUTH,
      payload: batch,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data?: { revision: number } };
    expect(body.data?.revision).toBe(1);

    const docRes = await app.inject({
      method: 'GET',
      url: '/api/v1/workspace/document',
      headers: AUTH,
    });
    const docBody = JSON.parse(docRes.body) as {
      data?: { document: DesignDocument; revision: number };
    };
    expect(docBody.data?.document.workspace.name).toBe('Updated Name');
    expect(docBody.data?.revision).toBe(1);
  });

  it('POST /workspace/operations rejects stale baseRevision with 409 E017', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/workspace',
      headers: AUTH,
      payload: { name: 'Initial Name' },
    });

    const batch: OperationBatch = {
      baseRevision: 99, // out of sync
      ops: [{ op: 'workspace.update', name: 'Updated Name' }],
      meta: { source: 'user', label: 'update name' },
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspace/operations',
      headers: AUTH,
      payload: batch,
    });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error?: { code?: string } };
    expect(body.error?.code).toBe('E017');
  });

  it('POST /workspace/trust updates trust status and returns SessionInfo', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/workspace',
      headers: AUTH,
      payload: { name: 'Trust Test' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workspace/trust',
      headers: AUTH,
      payload: { trusted: true },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data?: { workspace: { state: string; trusted: boolean } };
    };
    expect(body.data?.workspace.trusted).toBe(true);

    const invalidRes = await app.inject({
      method: 'POST',
      url: '/api/v1/workspace/trust',
      headers: AUTH,
      payload: { trusted: 'yes' }, // invalid type
    });
    expect(invalidRes.statusCode).toBe(400);
  });

  it('GET /workspace/backups lists backups and POST /workspace/backups/:id/restore restores', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/workspace',
      headers: AUTH,
      payload: { name: 'Backup Test' },
    });

    // Make an edit and flush to produce a backup
    await app.inject({
      method: 'POST',
      url: '/api/v1/workspace/operations',
      headers: AUTH,
      payload: {
        baseRevision: 0,
        ops: [{ op: 'workspace.update', name: 'Edited Test' }],
        meta: { source: 'user', label: 'edit' },
      },
    });

    if (currentStore) {
      await currentStore.flush();
    }

    const backupsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/workspace/backups',
      headers: AUTH,
    });
    expect(backupsRes.statusCode).toBe(200);
    const backupsBody = JSON.parse(backupsRes.body) as {
      data?: { backups: { id: string; file: string }[] };
    };
    expect(backupsBody.data?.backups.length).toBeGreaterThan(0);

    const backupId = backupsBody.data?.backups[0]?.id;
    if (backupId) {
      const restoreRes = await app.inject({
        method: 'POST',
        url: `/api/v1/workspace/backups/${backupId}/restore`,
        headers: AUTH,
      });
      expect(restoreRes.statusCode).toBe(200);
    }
  });

  it('POST /workspace/reload reloads workspace document', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/workspace',
      headers: AUTH,
      payload: { name: 'Reload Test' },
    });

    const reloadRes = await app.inject({
      method: 'POST',
      url: '/api/v1/workspace/reload',
      headers: AUTH,
    });
    expect(reloadRes.statusCode).toBe(200);
    const body = JSON.parse(reloadRes.body) as {
      data?: { document: DesignDocument; revision: number };
    };
    expect(body.data?.document.workspace.name).toBe('Reload Test');
  });
});
