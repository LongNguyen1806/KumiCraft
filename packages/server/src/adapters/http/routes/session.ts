// GET /api/v1/session (SPEC-03 section 5.1).
import type { FastifyInstance } from 'fastify';

import type { SessionInfo } from '../../../kernel/session.ts';

export function registerSessionRoutes(
  api: FastifyInstance,
  getSessionInfo: () => SessionInfo,
): void {
  api.get('/session', () => ({ data: getSessionInfo() }));
}
