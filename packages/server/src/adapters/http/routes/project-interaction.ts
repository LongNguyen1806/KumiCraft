// HTTP routes for project dark-mode and smooth-scroll configuration (K9.8-1 TK-75, TK-79).
import {
  ApplySmoothScrollRequestSchema,
  EnableDarkModeRequestSchema,
  issuesToDetails,
} from '@kumicraft/shared';
import type { FastifyInstance } from 'fastify';

import { enableProjectDarkMode } from '../../../core/project/dark-mode-service.ts';
import { applyProjectSmoothScroll } from '../../../core/project/smooth-scroll-service.ts';
import type { WrittenFile } from '../../../core/source-editor/source-editor-service.ts';
import { sendError } from '../send-error.ts';
import type { ProjectRoutesDeps } from './project.ts';

function darkModeDeps(deps: ProjectRoutesDeps) {
  const ws = deps.projectService.state();
  const fs = deps.fs;
  if (ws.status !== 'open' || fs === undefined) return undefined;
  return {
    root: ws.root,
    deps: {
      fs,
      styling: ws.support.styling,
      sourceDir: ws.file.sourceDir,
      tailwindCss: ws.file.styleFiles?.tokenFile ?? ws.support.styling?.globalCss[0],
      onWritten: (files: readonly WrittenFile[], labelKey: string) => {
        for (const f of files) deps.historyService?.recordInternalWrite(f.path, f.afterHash);
        deps.historyService?.push({ label: { key: labelKey }, files });
      },
    },
  };
}

export function registerProjectInteractionRoutes(
  api: FastifyInstance,
  deps: ProjectRoutesDeps,
): void {
  api.post('/project/dark-mode', async (request, reply) => {
    const parsed = EnableDarkModeRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const ctx = darkModeDeps(deps);
    if (!ctx) return sendError(reply, { code: 'E021', params: { missing: 'project' } });
    const res = await enableProjectDarkMode(ctx.deps, ctx.root, parsed.data.checkOnly === true);
    if (!res.ok) return sendError(reply, res.error);
    return { data: res.value };
  });

  api.post('/project/smooth-scroll', async (request, reply) => {
    const parsed = ApplySmoothScrollRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const ctx = darkModeDeps(deps);
    if (!ctx) return sendError(reply, { code: 'E021', params: { missing: 'project' } });
    const res = await applyProjectSmoothScroll(ctx.deps, ctx.root, parsed.data);
    if (!res.ok) return sendError(reply, res.error);
    return { data: res.value };
  });
}
