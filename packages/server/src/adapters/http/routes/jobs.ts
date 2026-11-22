// Job endpoints (SPEC-03 section 4.2): status after a lost WebSocket, and cancel.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { JobService } from '../../../services/jobs/job-service.ts';
import { sendError } from '../send-error.ts';

export type JobRoutesDeps = {
  readonly jobService: JobService;
};

const JobParamsSchema = z.strictObject({ id: z.string().min(1).max(64) });

export function registerJobRoutes(api: FastifyInstance, deps: JobRoutesDeps): void {
  api.get('/jobs/:id', async (request, reply) => {
    const params = JobParamsSchema.safeParse(request.params);
    if (!params.success) return sendError(reply, { code: 'E016' });
    const status = deps.jobService.get(params.data.id);
    if (!status.ok) return sendError(reply, status.error);
    return { data: status.value };
  });

  api.post('/jobs/:id/cancel', async (request, reply) => {
    const params = JobParamsSchema.safeParse(request.params);
    if (!params.success) return sendError(reply, { code: 'E016' });
    const cancelled = deps.jobService.cancel(params.data.id);
    if (!cancelled.ok) return sendError(reply, cancelled.error);
    reply.status(202);
    return { data: {} };
  });
}
