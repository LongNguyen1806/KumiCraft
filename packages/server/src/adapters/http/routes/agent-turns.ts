// REST endpoints for agent turns (WP-3.03b, R-AG-11, R-AG-15, R-AG-16).
import { StartTurnRequestSchema } from '@reactcraft/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { TurnRunner } from '../../../core/agent/turn-runner.ts';
import { sendError } from '../send-error.ts';

export type AgentTurnRoutesDeps = {
  readonly turnRunner: TurnRunner;
};

const TurnParamsSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
});

const DiffQuerySchema = z.strictObject({
  file: z.string().min(1),
});

export function registerAgentTurnRoutes(api: FastifyInstance, deps: AgentTurnRoutesDeps): void {
  api.post('/agent/turns', async (request, reply) => {
    const parsed = StartTurnRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016' });
    }
    const res = await deps.turnRunner.start(parsed.data);
    if (!res.ok) {
      return sendError(reply, res.error);
    }
    reply.status(202);
    return { data: { jobId: res.value.jobId } };
  });

  api.get('/agent/turns', async (_request, reply) => {
    const res = await deps.turnRunner.list();
    if (!res.ok) {
      return sendError(reply, res.error);
    }
    return { data: res.value };
  });

  api.get('/agent/turns/:id/diff', async (request, reply) => {
    const params = TurnParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, { code: 'E016' });
    }
    const query = DiffQuerySchema.safeParse(request.query);
    if (!query.success) {
      return sendError(reply, { code: 'E016' });
    }
    const res = await deps.turnRunner.diff(params.data.id, query.data.file);
    if (!res.ok) {
      return sendError(reply, res.error);
    }
    return { data: { diff: res.value } };
  });

  api.post('/agent/turns/:id/revert', async (request, reply) => {
    const params = TurnParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, { code: 'E016' });
    }
    const res = await deps.turnRunner.revert(params.data.id);
    if (!res.ok) {
      return sendError(reply, res.error);
    }
    return { data: res.value };
  });
}
