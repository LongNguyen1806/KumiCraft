// Project endpoints (SPEC-03 section 5.3).
import {
  AddPageSchema,
  DeletePageSchema,
  DesignDirsSchema,
  DevPortSchema,
  FrameSchema,
  issuesToDetails,
  PackageManagerSchema,
  RenamePageSchema,
  ResponsiveModeSchema,
} from '@reactcraft/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { ProjectService } from '../../../core/project/project-service.ts';
import type { SessionInfo } from '../../../core/shared/session.ts';
import { sendError } from '../send-error.ts';

export type ProjectRoutesDeps = {
  readonly projectService: ProjectService;
  readonly getSessionInfo: () => SessionInfo;
};

const OpenSchema = z.strictObject({ path: z.string().min(1) });
const CreateSchema = z.strictObject({
  path: z.string().min(1),
  name: z.string().min(1).max(64),
  packageManager: PackageManagerSchema.optional(),
});
const PatchSchema = z.strictObject({
  name: z.string().min(1).max(64).optional(),
  responsiveMode: ResponsiveModeSchema.optional(),
  frames: z.array(FrameSchema).min(1).max(8).optional(),
  primaryFrameId: z.string().optional(),
  // R-RN-27: 'auto' removes the saved port so the runner reads it from the project again.
  devPort: z.union([DevPortSchema, z.literal('auto')]).optional(),
  designDirs: DesignDirsSchema.optional(),
});
const TrustSchema = z.strictObject({ trusted: z.boolean() });
const InstallSchema = z.strictObject({ command: z.array(z.string()).min(1) });
const AddBackendSchema = z.strictObject({
  path: z.string().min(1),
  label: z.string().min(1).max(64).optional(),
});

function registerOpenCreateRoutes(api: FastifyInstance, deps: ProjectRoutesDeps): void {
  api.get('/project/probe', async (request, reply) => {
    const query = request.query as { path?: string };
    if (!query.path || query.path.trim().length === 0) {
      return sendError(reply, { code: 'E016', params: { field: 'path' } });
    }
    const result = await deps.projectService.probe(query.path);
    if (!result.ok) return sendError(reply, result.error);
    return { data: result.value };
  });

  api.post('/project/open', async (request, reply) => {
    const parsed = OpenSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.projectService.open(parsed.data.path);
    if (!result.ok) return sendError(reply, result.error);
    return { data: result.value };
  });

  api.post('/project/create', async (request, reply) => {
    const parsed = CreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.projectService.create(
      parsed.data.path,
      parsed.data.name,
      parsed.data.packageManager,
    );
    if (!result.ok) return sendError(reply, result.error);
    reply.status(201);
    return { data: result.value };
  });
}

function registerStateRoutes(api: FastifyInstance, deps: ProjectRoutesDeps): void {
  api.get('/project', async (_request, reply) => {
    const result = deps.projectService.getProjectInfo();
    if (!result.ok) return sendError(reply, result.error);
    return { data: result.value };
  });

  api.patch('/project', async (request, reply) => {
    const parsed = PatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.projectService.patchProject(parsed.data);
    if (!result.ok) return sendError(reply, result.error);
    return { data: result.value };
  });

  api.post('/project/close', async (_request, reply) => {
    await deps.projectService.close();
    reply.status(204);
    return undefined;
  });
}

/** What Studio reads from the project's code: its pages and its Tailwind theme. */
function registerCodeInfoRoutes(api: FastifyInstance, deps: ProjectRoutesDeps): void {
  api.get('/project/pages', async (_request, reply) => {
    const result = await deps.projectService.pages();
    if (!result.ok) return sendError(reply, result.error);
    return { data: result.value };
  });

  api.get('/project/theme', async (_request, reply) => {
    const result = await deps.projectService.theme();
    if (!result.ok) return sendError(reply, result.error);
    return { data: result.value };
  });
}

function registerOpsRoutes(api: FastifyInstance, deps: ProjectRoutesDeps): void {
  api.post('/project/trust', async (request, reply) => {
    const parsed = TrustSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const saved = await deps.projectService.setTrusted(parsed.data.trusted);
    if (!saved.ok) return sendError(reply, saved.error);
    return { data: deps.getSessionInfo() };
  });

  api.post('/project/install', async (request, reply) => {
    const parsed = InstallSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.projectService.install(parsed.data.command);
    if (!result.ok) return sendError(reply, result.error);
    reply.status(202);
    return { data: result.value };
  });

  api.post('/project/backends', async (request, reply) => {
    const parsed = AddBackendSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.projectService.addBackend(parsed.data.path, parsed.data.label);
    if (!result.ok) return sendError(reply, result.error);
    reply.status(201);
    return { data: result.value };
  });

  api.delete('/project/backends/:id', async (request, reply) => {
    const params = request.params as { id?: string };
    if (!params.id) {
      return sendError(reply, { code: 'E016', params: { field: 'id' } });
    }
    const result = await deps.projectService.removeBackend(params.id);
    if (!result.ok) return sendError(reply, result.error);
    reply.status(204);
    return undefined;
  });
}

function registerPageRoutes(api: FastifyInstance, deps: ProjectRoutesDeps): void {
  api.get('/project/dirs', async (_request, reply) => {
    const result = await deps.projectService.dirs();
    if (!result.ok) return sendError(reply, result.error);
    return { data: { dirs: result.value } };
  });

  api.post('/project/pages', async (request, reply) => {
    const parsed = AddPageSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.projectService.addPage(parsed.data);
    if (!result.ok) return sendError(reply, result.error);
    reply.status(201);
    return { data: result.value };
  });

  api.patch('/project/pages', async (request, reply) => {
    const parsed = RenamePageSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.projectService.renamePage(parsed.data);
    if (!result.ok) return sendError(reply, result.error);
    return { data: result.value };
  });

  api.delete('/project/pages', async (request, reply) => {
    const parsed = DeletePageSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.projectService.deletePage(parsed.data);
    if (!result.ok) return sendError(reply, result.error);
    return { data: result.value };
  });
}

export function registerProjectRoutes(api: FastifyInstance, deps: ProjectRoutesDeps): void {
  registerOpenCreateRoutes(api, deps);
  registerStateRoutes(api, deps);
  registerOpsRoutes(api, deps);
  registerCodeInfoRoutes(api, deps);
  registerPageRoutes(api, deps);
}
