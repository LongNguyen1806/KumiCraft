// Style layer endpoints (SPEC-03 section 9, SPEC-04 section 25.2).
import {
  issuesToDetails,
  StyleApplyRequestSchema,
  StyleReadRequestSchema,
} from '@reactcraft/shared';
import type { FastifyInstance } from 'fastify';

import type { HistoryService } from '../../../core/history/history-service.ts';
import type { FileSystemPort } from '../../../core/ports/file-system-port.ts';
import type { ProjectService } from '../../../core/project/project-service.ts';
import type { SourceEditorService } from '../../../core/source-editor/source-editor-service.ts';
import { applyStyleChange } from '../../../core/style/style-apply.ts';
import type { StyleService } from '../../../core/style/style-service.ts';
import { sendError } from '../send-error.ts';

export type StyleRoutesDeps = {
  readonly styleService: StyleService;
  readonly projectService: Pick<ProjectService, 'getProjectInfo'>;
  readonly fs: FileSystemPort;
  readonly sourceEditorService: Pick<SourceEditorService, 'getElement' | 'applyEdit'>;
  readonly historyService: Pick<HistoryService, 'push' | 'recordInternalWrite'>;
};

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
    const applied = await applyStyleChange(
      { fs: deps.fs, sourceEditor: deps.sourceEditorService },
      project.value.root,
      parsed.data,
    );
    if (!applied.ok) return sendError(reply, applied.error);
    const files = applied.value.files;
    if (files.length > 0) {
      for (const f of files) deps.historyService.recordInternalWrite(f.path, f.afterHash);
      deps.historyService.push({
        label: { key: 'history:setStyle', params: { tag: parsed.data.tag } },
        files,
      });
    }
    return reply.status(200).send({
      data: {
        files: files.map((f) => f.path),
        ...(applied.value.className === undefined ? {} : { className: applied.value.className }),
      },
    });
  });
}
