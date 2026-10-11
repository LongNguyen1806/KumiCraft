// Workspace and Design Document endpoints (SPEC-03 section 10.3).
import { type DesignDocument, OperationBatchSchema } from '@reactcraft/model';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { DesignStore } from '../../../core/design-store/design-store.ts';
import type { SessionInfo } from '../../../core/shared/session.ts';
import { CreateWorkspaceRequestSchema } from '../../../core/workspace/create-workspace.ts';
import type { WorkspaceService } from '../../../core/workspace/workspace-service.ts';
import { sendError } from '../send-error.ts';

export type WorkspaceRoutesDeps = {
  readonly workspaceService: WorkspaceService;
  readonly getDesignStore: () => DesignStore | undefined;
  readonly setDesignStore: (store: DesignStore | undefined) => void;
  readonly createDesignStore: (doc: DesignDocument, rev: number) => DesignStore;
  readonly getSessionInfo: () => SessionInfo;
};

const TrustSchema = z.strictObject({
  trusted: z.boolean(),
});

function registerDocumentRoutes(api: FastifyInstance, deps: WorkspaceRoutesDeps): void {
  api.get('/workspace/document', async (_request, reply) => {
    const store = deps.getDesignStore();
    if (!store) {
      return sendError(reply, { code: 'E015', params: { resource: 'workspace' } });
    }
    return { data: { document: store.document(), revision: store.revision() } };
  });

  api.post('/workspace/reload', async (_request, reply) => {
    const store = deps.getDesignStore();
    if (!store) {
      return sendError(reply, { code: 'E015', params: { resource: 'workspace' } });
    }

    const reloaded = await deps.workspaceService.reload();
    if (reloaded.status !== 'open') {
      return sendError(reply, { code: 'E003', params: { resource: 'workspace' } });
    }

    await store.reload(reloaded.document, reloaded.document.workspace.revision);
    return { data: { document: store.document(), revision: store.revision() } };
  });
}

function registerCreateWorkspaceRoute(api: FastifyInstance, deps: WorkspaceRoutesDeps): void {
  api.post('/workspace', async (request, reply) => {
    const parsed = CreateWorkspaceRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, {
        code: 'E016',
        params: { reason: parsed.error.issues[0]?.message ?? 'invalid_request' },
        details: parsed.error.issues.map((i) => ({
          file: '',
          path: i.path.map(String).join('.'),
          message: i.message,
        })),
      });
    }

    const result = await deps.workspaceService.create(parsed.data);
    if (!result.ok) {
      return sendError(reply, result.error);
    }

    if (result.value.status === 'open') {
      const store = deps.createDesignStore(
        result.value.document,
        result.value.document.workspace.revision,
      );
      deps.setDesignStore(store);
      return reply.status(201).send({ data: result.value.document.workspace });
    }

    return sendError(reply, { code: 'E018', params: { resource: 'workspace' } });
  });
}

function registerOperationRoutes(api: FastifyInstance, deps: WorkspaceRoutesDeps): void {
  api.post('/workspace/operations', async (request, reply) => {
    const store = deps.getDesignStore();
    if (!store) {
      return sendError(reply, { code: 'E015', params: { resource: 'workspace' } });
    }

    const parsed = OperationBatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, {
        code: 'E016',
        params: { reason: 'invalid_batch' },
        details: parsed.error.issues.map((i) => ({
          file: '',
          path: i.path.map(String).join('.'),
          message: i.message,
        })),
      });
    }

    const applied = await store.applyBatch(parsed.data);
    if (!applied.ok) {
      return sendError(reply, applied.error);
    }

    return { data: { revision: applied.value.revision, idMap: applied.value.idMap } };
  });
}

function registerBackupRoutes(api: FastifyInstance, deps: WorkspaceRoutesDeps): void {
  api.get('/workspace/backups', async (_request, reply) => {
    const store = deps.getDesignStore();
    if (!store) {
      return sendError(reply, { code: 'E015', params: { resource: 'workspace' } });
    }

    const backupsRes = await store.listBackups();
    if (!backupsRes.ok) {
      return sendError(reply, backupsRes.error);
    }

    return { data: { backups: backupsRes.value } };
  });

  api.post<{ Params: { id: string } }>('/workspace/backups/:id/restore', async (request, reply) => {
    const store = deps.getDesignStore();
    if (!store) {
      return sendError(reply, { code: 'E015', params: { resource: 'workspace' } });
    }

    const restoreRes = await store.restoreBackup(request.params.id);
    if (!restoreRes.ok) {
      return sendError(reply, restoreRes.error);
    }

    const reloaded = await deps.workspaceService.reload();
    if (reloaded.status === 'open') {
      await store.reload(reloaded.document, reloaded.document.workspace.revision);
    }

    return { data: { document: store.document(), revision: store.revision() } };
  });
}

function registerTrustRoute(api: FastifyInstance, deps: WorkspaceRoutesDeps): void {
  api.post('/workspace/trust', async (request, reply) => {
    const parsed = TrustSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, {
        code: 'E016',
        params: { reason: 'invalid_trust_payload' },
      });
    }

    const trustedRes = await deps.workspaceService.setTrusted(parsed.data.trusted);
    if (!trustedRes.ok) {
      return sendError(reply, trustedRes.error);
    }

    return { data: deps.getSessionInfo() };
  });
}

export function registerWorkspaceRoutes(api: FastifyInstance, deps: WorkspaceRoutesDeps): void {
  registerDocumentRoutes(api, deps);
  registerCreateWorkspaceRoute(api, deps);
  registerOperationRoutes(api, deps);
  registerBackupRoutes(api, deps);
  registerTrustRoute(api, deps);
}
