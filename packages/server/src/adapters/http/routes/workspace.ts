// Workspace and Design Document endpoints (SPEC-03 section 10.3).
import { type DesignDocument, OperationBatchSchema } from '@reactcraft/model';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

import type { DesignStore } from '../../../core/design-store/design-store.ts';
import type { FileSystemPort } from '../../../core/ports/file-system-port.ts';
import type { SessionInfo } from '../../../core/shared/session.ts';
import { listBackups, restoreBackup } from '../../../core/workspace/backup-files.ts';
import { CreateWorkspaceRequestSchema } from '../../../core/workspace/create-workspace.ts';
import type { WorkspaceService } from '../../../core/workspace/workspace-service.ts';
import { sendError } from '../send-error.ts';

export type WorkspaceRoutesDeps = {
  readonly workspaceService: WorkspaceService;
  readonly getDesignStore: () => DesignStore | undefined;
  readonly setDesignStore: (store: DesignStore | undefined) => void;
  readonly createDesignStore: (doc: DesignDocument, rev: number) => DesignStore;
  readonly getSessionInfo: () => SessionInfo;
  /** Backups are read and restored without a design store: the error screen needs them. */
  readonly fs: FileSystemPort;
  readonly root: string;
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
    if (deps.workspaceService.state().status === 'none') {
      return sendError(reply, { code: 'E015', params: { resource: 'workspace' } });
    }
    return reopen(deps, reply);
  });
}

/**
 * Reads the workspace again. Open: the store follows the files (or is created, when the workspace
 * was in error until now) and the document is returned. Still in error: the session says which
 * files, so the Studio can show them.
 */
async function reopen(deps: WorkspaceRoutesDeps, reply: FastifyReply) {
  const reloaded = await deps.workspaceService.reload();
  if (reloaded.status !== 'open') return { data: { session: deps.getSessionInfo() } };
  const revision = reloaded.document.workspace.revision;
  const store = deps.getDesignStore();
  if (store) await store.reload(reloaded.document, revision);
  else deps.setDesignStore(deps.createDesignStore(reloaded.document, revision));
  const current = deps.getDesignStore();
  if (!current) return sendError(reply, { code: 'E013' });
  return { data: { document: current.document(), revision: current.revision() } };
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
    const backups = await listBackups(deps.fs, deps.root);
    return backups.ok ? { data: { backups: backups.value } } : sendError(reply, backups.error);
  });

  api.post<{ Params: { id: string } }>('/workspace/backups/:id/restore', async (request, reply) => {
    const restored = await restoreBackup(deps.fs, deps.root, request.params.id);
    if (!restored.ok) return sendError(reply, restored.error);
    return reopen(deps, reply);
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
