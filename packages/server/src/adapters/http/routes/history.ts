// History HTTP endpoints (SPEC-03 section 5.6, SPEC-04 section 7).
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { HistoryService } from '../../../core/history/history-service.ts';
import { sendError } from '../send-error.ts';

export type HistoryRoutesDeps = {
  readonly historyService: HistoryService;
  readonly getProjectRoot: () => string | undefined;
};

async function handleGetHistory(
  deps: HistoryRoutesDeps,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const projectRoot = deps.getProjectRoot();
  if (!projectRoot) {
    return sendError(reply, { code: 'E021' });
  }

  const state = deps.historyService.getState();
  return reply.status(200).send({ data: state });
}

async function handleUndo(deps: HistoryRoutesDeps, _request: FastifyRequest, reply: FastifyReply) {
  const projectRoot = deps.getProjectRoot();
  if (!projectRoot) {
    return sendError(reply, { code: 'E021' });
  }

  const result = await deps.historyService.undo(projectRoot);
  if (!result.ok) {
    return sendError(reply, result.error);
  }

  return reply.status(200).send({ data: result.value });
}

async function handleRedo(deps: HistoryRoutesDeps, _request: FastifyRequest, reply: FastifyReply) {
  const projectRoot = deps.getProjectRoot();
  if (!projectRoot) {
    return sendError(reply, { code: 'E021' });
  }

  const result = await deps.historyService.redo(projectRoot);
  if (!result.ok) {
    return sendError(reply, result.error);
  }

  return reply.status(200).send({ data: result.value });
}

export function registerHistoryRoutes(api: FastifyInstance, deps: HistoryRoutesDeps): void {
  api.get('/history', (req, rep) => handleGetHistory(deps, req, rep));
  api.post('/history/undo', (req, rep) => handleUndo(deps, req, rep));
  api.post('/history/redo', (req, rep) => handleRedo(deps, req, rep));
}
