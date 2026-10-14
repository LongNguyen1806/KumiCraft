// Project endpoints (SPEC-03 section 5.3). Phase 1 starts with trust; open, create, install and
// backends come with M-PJ (WP-1.03).
import { issuesToDetails } from '@reactcraft/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { SessionInfo } from '../../../core/shared/session.ts';
import type { WorkspaceService } from '../../../core/workspace/workspace-service.ts';
import { sendError } from '../send-error.ts';

export type ProjectRoutesDeps = {
  readonly workspaceService: Pick<WorkspaceService, 'setTrusted'>;
  readonly getSessionInfo: () => SessionInfo;
};

const TrustSchema = z.strictObject({ trusted: z.boolean() });

export function registerProjectRoutes(api: FastifyInstance, deps: ProjectRoutesDeps): void {
  api.post('/project/trust', async (request, reply) => {
    const parsed = TrustSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const saved = await deps.workspaceService.setTrusted(parsed.data.trusted);
    if (!saved.ok) return sendError(reply, saved.error);
    return { data: deps.getSessionInfo() };
  });
}
