// Tests for GET /api/v1/agents route (WP-3.03a, R-AG-10).
import { AgentStatusSchema } from '@reactcraft/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { AgentService } from '../../../core/agent/agent-service.ts';
import { createSessionInfoProvider } from '../../../core/shared/session.ts';
import { platform } from '../../../core/workspace/test-support.ts';
import { createHttpApp } from '../create-http-app.ts';

const PORT = 50240;
const TOKEN = 'test-token-agents';
const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
};

const AgentsResponseSchema = z.strictObject({
  data: z.array(AgentStatusSchema),
});

describe('GET /api/v1/agents route [R-AG-10]', () => {
  let app: FastifyInstance;

  const fakeAgentService: AgentService = {
    statuses: () =>
      Promise.resolve([
        { id: 'agy', installed: true, version: '1.4.3', login: 'unknown' },
        { id: 'claude', installed: false, login: 'unknown' },
      ]),
    resolve: () => Promise.reject(new Error('Not used in route test')),
  };

  beforeEach(async () => {
    app = await createHttpApp({
      logLevel: 'silent',
      security: { port: PORT, sessionToken: TOKEN, trustedOrigins: [] },
      getSessionInfo: createSessionInfoProvider({
        version: '1.0.0',
        platform,
        features: [],
        readProject: () => ({ state: 'none', suggestedPath: '' }),
      }),
      agentRoutes: { agentService: fakeAgentService },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 with agent status array when authenticated, and 401 without token', async () => {
    const authorizedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/agents',
      headers: HEADERS,
    });

    expect(authorizedRes.statusCode).toBe(200);
    const parsed = AgentsResponseSchema.safeParse(authorizedRes.json());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data).toHaveLength(2);
      expect(parsed.data.data[0]).toEqual({
        id: 'agy',
        installed: true,
        version: '1.4.3',
        login: 'unknown',
      });
      expect(parsed.data.data[1]).toEqual({
        id: 'claude',
        installed: false,
        login: 'unknown',
      });
    }

    const unauthorizedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/agents',
      headers: { host: `127.0.0.1:${String(PORT)}` },
    });

    expect(unauthorizedRes.statusCode).toBe(401);
  });
});
