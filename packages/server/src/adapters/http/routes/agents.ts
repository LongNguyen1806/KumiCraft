// Agent discovery, installation and login endpoints (WP-3.03a, WP-3.06b, R-AG-10, R-AG-21).
import { AgentIdSchema, AgentInstallRequestSchema } from '@reactcraft/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { AgentService } from '../../../core/agent/agent-service.ts';
import type { AgentSetupService } from '../../../core/agent/agent-setup-service.ts';
import { sendError } from '../send-error.ts';

export type AgentRoutesDeps = {
  readonly agentService: AgentService;
  readonly setupService?: AgentSetupService | undefined;
};

const AgentParamsSchema = z.strictObject({
  id: AgentIdSchema,
});

export function registerAgentRoutes(api: FastifyInstance, deps: AgentRoutesDeps): void {
  api.get('/agents', async () => ({ data: await deps.agentService.statuses() }));

  api.post('/agents/:id/install', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedParams = AgentParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return sendError(reply, { code: 'E016' });
    }

    const parsedBody = AgentInstallRequestSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return sendError(reply, { code: 'E016' });
    }

    if (deps.setupService === undefined) {
      return sendError(reply, { code: 'E016' });
    }

    const res = deps.setupService.startInstall(parsedParams.data.id, parsedBody.data.command);
    if (!res.ok) {
      return sendError(reply, res.error);
    }
    return reply.status(202).send({ data: { jobId: res.value.jobId } });
  });

  api.post('/agents/:id/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedParams = AgentParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return sendError(reply, { code: 'E016' });
    }

    if (deps.setupService === undefined) {
      return sendError(reply, { code: 'E016' });
    }

    const res = await deps.setupService.openLogin(parsedParams.data.id);
    if (!res.ok) {
      return sendError(reply, res.error);
    }
    return reply.status(204).send();
  });
}
