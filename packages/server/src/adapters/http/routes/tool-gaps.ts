// Tool gaps reported by external AI agents (R-AG-20): read by the Studio, written over MCP.
import {
  issuesToDetails,
  type ProjectInfo,
  type Result,
  ToolGapReportSchema,
} from '@reactcraft/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';

import type { ToolGapStore } from '../../../core/agent/tool-gaps.ts';
import { sendError } from '../send-error.ts';

export type ToolGapRoutesDeps = {
  readonly store: ToolGapStore;
  readonly getProjectInfo: () => Result<ProjectInfo>;
};

/** The open, trusted project's root; otherwise the error already sent. */
function trustedRoot(deps: ToolGapRoutesDeps, reply: FastifyReply): string | undefined {
  const project = deps.getProjectInfo();
  if (!project.ok) {
    void sendError(reply, { code: 'E021', params: { missing: 'project' } });
    return undefined;
  }
  if (!project.value.trusted) {
    void sendError(reply, { code: 'E011', params: { reason: 'untrusted' } });
    return undefined;
  }
  return project.value.root;
}

export function registerToolGapRoutes(api: FastifyInstance, deps: ToolGapRoutesDeps): void {
  api.get('/tool-gaps', async (_request, reply) => {
    const root = trustedRoot(deps, reply);
    if (root === undefined) return reply;
    return { data: await deps.store.list(root) };
  });

  api.post('/tool-gaps', async (request, reply) => {
    const root = trustedRoot(deps, reply);
    if (root === undefined) return reply;
    const parsed = ToolGapReportSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await deps.store.report(root, parsed.data);
    if (!result.ok) return sendError(reply, result.error);
    reply.status(201);
    return { data: result.value };
  });
}
