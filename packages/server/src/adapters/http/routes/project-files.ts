// Project file tree and file operations endpoints (SPEC-04 K3b, spec-log #70).
import {
  FileCreateSchema,
  FileDeleteSchema,
  FileRenameSchema,
  issuesToDetails,
  RelPathSchema,
} from '@kumicraft/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { HistoryService } from '../../../kernel/history/history-service.ts';
import { listFileTree } from '../../../lib/file-tree.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';
import {
  createFile,
  deleteFileOrDir,
  renameFileOrDir,
} from '../../../services/project/file-ops.ts';
import type { ProjectService } from '../../../services/project/project-service.ts';
import { sendError } from '../send-error.ts';
import { VIEW_ONLY, viewFeaturesOf } from '../view-features.ts';

export type ProjectFilesRoutesDeps = {
  readonly projectService: ProjectService;
  readonly fs?: FileSystemPort | undefined;
  readonly historyService?: HistoryService | undefined;
};

const TreeQuerySchema = z.strictObject({
  dir: z.string().max(1024).optional(),
});

const ImportersQuerySchema = z.strictObject({
  path: RelPathSchema,
});

function registerTreeAndImportersRoutes(api: FastifyInstance, deps: ProjectFilesRoutesDeps): void {
  api.get('/project/tree', async (request, reply) => {
    const infoRes = deps.projectService.getProjectInfo();
    if (!infoRes.ok) return sendError(reply, { code: 'E021', params: { missing: 'project' } });
    if (!deps.fs) return sendError(reply, { code: 'E021', params: { missing: 'fs' } });

    const parsed = TreeQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }

    const dir = parsed.data.dir ?? '';
    const res = await listFileTree(deps.fs, infoRes.value.root, dir);
    if (!res.ok) return sendError(reply, res.error);
    return { data: res.value };
  });

  api.get('/project/files/importers', async (request, reply) => {
    const infoRes = deps.projectService.getProjectInfo();
    if (!infoRes.ok) return sendError(reply, { code: 'E021', params: { missing: 'project' } });
    if (!deps.fs) return sendError(reply, { code: 'E021', params: { missing: 'fs' } });

    const parsed = ImportersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }

    const features = viewFeaturesOf(deps.projectService);
    if (!features) return sendError(reply, VIEW_ONLY);
    const res = await features.findFileImporters(
      deps.fs,
      infoRes.value.root,
      infoRes.value.sourceDir,
      parsed.data.path,
    );
    if (!res.ok) return sendError(reply, res.error);
    return { data: res.value };
  });
}

function registerCreateAndRenameRoutes(api: FastifyInstance, deps: ProjectFilesRoutesDeps): void {
  api.post('/project/files', async (request, reply) => {
    const infoRes = deps.projectService.getProjectInfo();
    if (!infoRes.ok) return sendError(reply, { code: 'E021', params: { missing: 'project' } });
    if (!deps.fs) return sendError(reply, { code: 'E021', params: { missing: 'fs' } });

    const parsed = FileCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }

    const res = await createFile(
      { fs: deps.fs, history: deps.historyService },
      infoRes.value.root,
      parsed.data.path,
      parsed.data.kind,
    );
    if (!res.ok) return sendError(reply, res.error);
    reply.status(201);
    return { data: { created: true } };
  });

  api.post('/project/files/rename', async (request, reply) => {
    const infoRes = deps.projectService.getProjectInfo();
    if (!infoRes.ok) return sendError(reply, { code: 'E021', params: { missing: 'project' } });
    if (!deps.fs) return sendError(reply, { code: 'E021', params: { missing: 'fs' } });

    const parsed = FileRenameSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }

    const res = await renameFileOrDir(
      { fs: deps.fs, history: deps.historyService },
      infoRes.value.root,
      parsed.data.from,
      parsed.data.to,
    );
    if (!res.ok) return sendError(reply, res.error);
    return { data: { renamed: true } };
  });
}

function registerDeleteRoute(api: FastifyInstance, deps: ProjectFilesRoutesDeps): void {
  api.delete('/project/files', async (request, reply) => {
    const infoRes = deps.projectService.getProjectInfo();
    if (!infoRes.ok) return sendError(reply, { code: 'E021', params: { missing: 'project' } });
    if (!deps.fs) return sendError(reply, { code: 'E021', params: { missing: 'fs' } });

    const parsed = FileDeleteSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }

    const res = await deleteFileOrDir(
      { fs: deps.fs, history: deps.historyService },
      infoRes.value.root,
      parsed.data.path,
    );
    if (!res.ok) return sendError(reply, res.error);
    return { data: { deleted: true } };
  });
}

export function registerProjectFilesRoutes(
  api: FastifyInstance,
  deps: ProjectFilesRoutesDeps,
): void {
  registerTreeAndImportersRoutes(api, deps);
  registerCreateAndRenameRoutes(api, deps);
  registerDeleteRoute(api, deps);
}
