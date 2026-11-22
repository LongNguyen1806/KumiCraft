// Build check endpoint (SPEC-04 M-BC): starts the `project.buildCheck` job; the result comes with
// the job (GET /jobs/{id}, `job.completed`).
import type { FastifyInstance } from 'fastify';

import type { Result } from '../../../kernel/result.ts';
import { sendError } from '../send-error.ts';

export type BuildCheckRoutesDeps = {
  readonly start: () => Result<{ readonly jobId: string }>;
};

export function registerBuildCheckRoutes(api: FastifyInstance, deps: BuildCheckRoutesDeps): void {
  api.post('/project/build-check', async (_request, reply) => {
    const started = deps.start();
    if (!started.ok) return sendError(reply, started.error);
    return reply.status(202).send({ data: started.value });
  });
}
