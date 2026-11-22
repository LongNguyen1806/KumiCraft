// Style layer endpoints (SPEC-03 section 9, SPEC-04 section 25.2).
import {
  issuesToDetails,
  type ProjectInfo,
  type Result,
  type StyleApplyRequest,
  StyleApplyRequestSchema,
  StyleReadRequestSchema,
  type ThemeInfo,
} from '@kumicraft/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';

import type { SourceEditorService } from '../../../kernel/editing.ts';
import type { StyleService } from '../../../kernel/features.ts';
import type { HistoryService } from '../../../kernel/history/history-service.ts';
import type { CompiledCssPort } from '../../../ports/compiled-css-port.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';
import type { ProjectService } from '../../../services/project/project-service.ts';
import { sendError } from '../send-error.ts';

export type StyleRoutesDeps = {
  readonly styleService: StyleService;
  readonly projectService: Pick<ProjectService, 'getProjectInfo'> & {
    readonly theme?: () => Promise<Result<ThemeInfo>>;
  };
  readonly fs: FileSystemPort;
  readonly sourceEditorService: Pick<SourceEditorService, 'getElement' | 'applyEdit'>;
  readonly historyService: Pick<HistoryService, 'push' | 'recordInternalWrite'>;
  /** The dev server's compiled stylesheets, for exact source-map lookups (R-ST-04). */
  readonly compiledCss?: CompiledCssPort | undefined;
};

async function handleStyleApply(
  deps: StyleRoutesDeps,
  project: Extract<Result<ProjectInfo>, { ok: true }>['value'],
  parsedData: StyleApplyRequest,
  reply: FastifyReply,
) {
  const themeRes = await deps.projectService.theme?.();
  const theme = themeRes?.ok ? themeRes.value : undefined;
  const applied = await deps.styleService.apply(
    {
      fs: deps.fs,
      sourceEditor: deps.sourceEditorService,
      styling: project.support.styling,
      compiledCss: deps.compiledCss,
      newCssDir: project.styleFiles?.newCssDir,
      theme,
    },
    project.root,
    parsedData,
  );
  if (!applied.ok) return sendError(reply, applied.error);
  const files = applied.value.files;
  if (files.length > 0) {
    for (const f of files) deps.historyService.recordInternalWrite(f.path, f.afterHash);
    deps.historyService.push({
      label: { key: 'history:setStyle', params: { tag: parsedData.tag } },
      files,
    });
  }
  return reply.status(200).send({
    data: {
      files: files.map((f) => f.path),
      ...(applied.value.className === undefined ? {} : { className: applied.value.className }),
    },
  });
}

export function registerStyleRoutes(api: FastifyInstance, deps: StyleRoutesDeps): void {
  // R-ST-04: the Studio relays the Bridge's style-probe; the server maps each rule to its file.
  api.post('/style/read', async (request, reply) => {
    const project = deps.projectService.getProjectInfo();
    if (!project.ok) return sendError(reply, project.error);
    const parsed = StyleReadRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const reading = await deps.styleService.read(
      { root: project.value.root, styling: project.value.support.styling },
      parsed.data.probe,
    );
    return reply.status(200).send({ data: reading });
  });

  // R-ST-06, R-ST-15: one Inspector change of a CSS project, one history entry for every file.
  api.post('/style/apply', async (request, reply) => {
    const project = deps.projectService.getProjectInfo();
    if (!project.ok) return sendError(reply, project.error);
    const parsed = StyleApplyRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    return handleStyleApply(deps, project.value, parsed.data, reply);
  });
}
