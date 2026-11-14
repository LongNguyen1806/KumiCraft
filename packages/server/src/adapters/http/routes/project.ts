// Project endpoints (SPEC-03 section 5.3).
import {
  AddPageSchema,
  CreateDraftSchema,
  DeletePageSchema,
  DesignDirsSchema,
  DevPortSchema,
  DraftFileSchema,
  ExtractComponentSchema,
  FrameSchema,
  issuesToDetails,
  LoginSessionsSchema,
  PackageManagerSchema,
  PromoteDraftSchema,
  RenameDraftSchema,
  RenamePageSchema,
  ResponsiveModeSchema,
  RoutingSchema,
  StyleFilesSchema,
  THEME_TOKEN_NAME,
  ThemeEditSchema,
  ThemeTokenKindSchema,
  WorkspaceAiSchema,
} from '@kumicraft/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { HistoryService } from '../../../core/history/history-service.ts';
import type { FileSystemPort } from '../../../core/ports/file-system-port.ts';
import type { ProcessPort } from '../../../core/ports/process-port.ts';
import { listProjectComponents } from '../../../core/project/components-list.ts';
import { listPublicImages } from '../../../core/project/images.ts';
import type { ProjectService } from '../../../core/project/project-service.ts';
import type { SessionInfo } from '../../../core/shared/session.ts';
import type { ConfigStore } from '../../../core/shared/user-config.ts';
import type { UsageCounter } from '../../../core/source-editor/component-usages.ts';
import { sendError } from '../send-error.ts';
import { registerProjectDataRoutes } from './project-data.ts';
import { registerProjectFilesRoutes } from './project-files.ts';
import { registerRecentProjectRoutes } from './project-recent.ts';

export type ProjectRoutesDeps = {
  readonly projectService: ProjectService;
  readonly getSessionInfo: () => SessionInfo;
  readonly fs?: FileSystemPort | undefined;
  readonly process?: ProcessPort | undefined;
  readonly tsInspectScript?: string | undefined;
  readonly usageCounter?: UsageCounter | undefined;
  readonly recents?: Pick<ConfigStore, 'recentProjects' | 'forgetProject'> | undefined;
  readonly historyService?: HistoryService | undefined;
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
  styleFiles: StyleFilesSchema.optional(),
  routing: RoutingSchema.optional(),
  sessions: LoginSessionsSchema.optional(),
  ai: WorkspaceAiSchema.optional(),
});
const TrustSchema = z.strictObject({ trusted: z.boolean() });
const InstallSchema = z.strictObject({ command: z.array(z.string()).min(1) });
const AddBackendSchema = z.strictObject({
  path: z.string().min(1),
  label: z.string().min(1).max(64).optional(),
});
const ThemeUsageQuerySchema = z.strictObject({
  kind: ThemeTokenKindSchema,
  name: z.string().regex(THEME_TOKEN_NAME),
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

  api.get('/project/assets', async (_request, reply) => {
    const infoRes = deps.projectService.getProjectInfo();
    if (!infoRes.ok) return sendError(reply, infoRes.error);
    if (!deps.fs) return sendError(reply, { code: 'E021' });
    const listRes = await listPublicImages(deps.fs, infoRes.value.root);
    if (!listRes.ok) return sendError(reply, listRes.error);
    return { data: { files: listRes.value } };
  });

  api.get('/project/components', async (_request, reply) => {
    const infoRes = deps.projectService.getProjectInfo();
    if (!infoRes.ok) return sendError(reply, infoRes.error);
    if (!deps.fs) return sendError(reply, { code: 'E021' });
    const components = await listProjectComponents(
      { fs: deps.fs, usageCounter: deps.usageCounter },
      infoRes.value.root,
      infoRes.value,
    );
    return { data: { components } };
  });

  api.post('/project/components/extract', async (request, reply) => {
    const infoRes = deps.projectService.getProjectInfo();
    if (!infoRes.ok) return sendError(reply, { code: 'E021', params: { missing: 'project' } });
    const parsed = ExtractComponentSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.projectService.extractComponent(parsed.data);
    if (!result.ok) return sendError(reply, result.error);
    reply.status(201);
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

  api.post('/project/router/install', async (_request, reply) => {
    if (!deps.projectService.installRouter) {
      return sendError(reply, { code: 'E021', params: { missing: 'project' } });
    }
    const result = await deps.projectService.installRouter();
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

function registerDraftCrudRoutes(api: FastifyInstance, deps: ProjectRoutesDeps): void {
  api.get('/project/drafts', async (_request, reply) => {
    const result = await deps.projectService.listDrafts();
    if (!result.ok) return sendError(reply, result.error);
    return { data: result.value };
  });

  api.post('/project/drafts', async (request, reply) => {
    const parsed = CreateDraftSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.projectService.createDraft(parsed.data);
    if (!result.ok) return sendError(reply, result.error);
    reply.status(201);
    return { data: result.value };
  });

  api.patch('/project/drafts', async (request, reply) => {
    const parsed = RenameDraftSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.projectService.renameDraft(parsed.data);
    if (!result.ok) return sendError(reply, result.error);
    return { data: result.value };
  });

  api.delete('/project/drafts', async (request, reply) => {
    const parsed = DraftFileSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.projectService.deleteDraft(parsed.data);
    if (!result.ok) return sendError(reply, result.error);
    return { data: result.value };
  });
}

function registerDraftOpRoutes(api: FastifyInstance, deps: ProjectRoutesDeps): void {
  api.post('/project/drafts/duplicate', async (request, reply) => {
    const parsed = DraftFileSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.projectService.duplicateDraft(parsed.data);
    if (!result.ok) return sendError(reply, result.error);
    reply.status(201);
    return { data: result.value };
  });

  api.post('/project/drafts/promote', async (request, reply) => {
    const parsed = PromoteDraftSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.projectService.promoteDraft(parsed.data);
    if (!result.ok) return sendError(reply, result.error);
    reply.status(201);
    return { data: result.value };
  });
}

function registerThemeRoutes(api: FastifyInstance, deps: ProjectRoutesDeps): void {
  api.patch('/project/theme', async (request, reply) => {
    const parsed = ThemeEditSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.projectService.editTheme(parsed.data);
    if (!result.ok) return sendError(reply, result.error);
    return { data: result.value };
  });

  api.get('/project/theme/usage', async (request, reply) => {
    const parsed = ThemeUsageQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.projectService.themeUsage(parsed.data.kind, parsed.data.name);
    if (!result.ok) return sendError(reply, result.error);
    return { data: result.value };
  });
}

export function registerProjectRoutes(api: FastifyInstance, deps: ProjectRoutesDeps): void {
  registerOpenCreateRoutes(api, deps);
  registerRecentProjectRoutes(api, deps);
  registerProjectFilesRoutes(api, deps);
  registerStateRoutes(api, deps);
  registerOpsRoutes(api, deps);
  registerCodeInfoRoutes(api, deps);
  registerPageRoutes(api, deps);
  registerDraftCrudRoutes(api, deps);
  registerDraftOpRoutes(api, deps);
  registerThemeRoutes(api, deps);
  registerProjectDataRoutes(api, deps);
}
