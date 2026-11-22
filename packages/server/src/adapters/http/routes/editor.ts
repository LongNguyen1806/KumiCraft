// POST /api/v1/open-in-editor (SPEC-03 section 5.1, R-SL-06).
import { issuesToDetails } from '@kumicraft/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { openInEditor, type OpenInEditorDeps } from '../../../services/project/open-in-editor.ts';
import { sendError } from '../send-error.ts';

export type EditorRoutesDeps = OpenInEditorDeps & {
  readonly getProjectRoot: () => string | undefined;
};

const OpenSchema = z.strictObject({ loc: z.string().min(1).max(600) });

export function registerEditorRoutes(api: FastifyInstance, deps: EditorRoutesDeps): void {
  api.post('/open-in-editor', async (request, reply) => {
    const root = deps.getProjectRoot();
    if (root === undefined)
      return sendError(reply, { code: 'E021', params: { missing: 'project' } });
    const parsed = OpenSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const opened = await openInEditor(deps, root, parsed.data.loc);
    if (!opened.ok) return sendError(reply, opened.error);
    return reply.status(204).send();
  });
}
