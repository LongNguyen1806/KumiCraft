// Agent discovery endpoints (WP-3.03a, SPEC-03 section 5).
import type { FastifyInstance } from 'fastify';

import type { AgentService } from '../../../core/agent/agent-service.ts';

export type AgentRoutesDeps = {
  readonly agentService: AgentService;
};

export function registerAgentRoutes(api: FastifyInstance, deps: AgentRoutesDeps): void {
  api.get('/agents', async () => ({ data: await deps.agentService.statuses() }));
}
