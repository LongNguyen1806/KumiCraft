// Runner dev server endpoints (SPEC-03 section 5.4, R-RN-01 to R-RN-09).
import type { FastifyInstance } from 'fastify';

import type { RunnerService } from '../../../core/runner/runner-service.ts';
import { sendError } from '../send-error.ts';

export type RunnerRoutesDeps = {
  readonly runnerService: RunnerService;
};

export function registerRunnerRoutes(api: FastifyInstance, deps: RunnerRoutesDeps): void {
  api.get('/runner', (_request, reply) => {
    const status = deps.runnerService.getStatus();
    return reply.status(200).send({ data: status });
  });

  api.post('/runner/start', async (_request, reply) => {
    const result = await deps.runnerService.start();
    if (!result.ok) {
      return sendError(reply, result.error);
    }
    return reply.status(202).send({ data: result.value });
  });

  api.post('/runner/restart', async (_request, reply) => {
    const result = await deps.runnerService.restart();
    if (!result.ok) {
      return sendError(reply, result.error);
    }
    return reply.status(202).send({ data: result.value });
  });

  api.post('/runner/stop', async (_request, reply) => {
    const result = await deps.runnerService.stop();
    if (!result.ok) {
      return sendError(reply, result.error);
    }
    return reply.status(200).send({ data: result.value });
  });
}
