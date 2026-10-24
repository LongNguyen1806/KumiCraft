// REST endpoints for agent turns and images (WP-3.03b, R-AG-11, R-AG-15, R-AG-16, R-CH-02).
import {
  ChatImageUploadSchema,
  type ProjectInfo,
  type Result,
  StartTurnRequestSchema,
} from '@kumicraft/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { ChatImageStore } from '../../../core/agent/chat-images.ts';
import type { TurnRunner } from '../../../core/agent/turn-runner.ts';
import { sendError } from '../send-error.ts';

export type AgentTurnRoutesDeps = {
  readonly turnRunner: TurnRunner;
  readonly chatImages?: ChatImageStore | undefined;
  readonly getProjectInfo?: (() => Result<ProjectInfo>) | undefined;
};

const TurnParamsSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
});

const DiffQuerySchema = z.strictObject({
  file: z.string().min(1),
});

async function handlePostImage(
  deps: AgentTurnRoutesDeps,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (deps.getProjectInfo === undefined || deps.chatImages === undefined) {
    return sendError(reply, { code: 'E021', params: { missing: 'project' } });
  }
  const pRes = deps.getProjectInfo();
  if (!pRes.ok) {
    return sendError(reply, { code: 'E021', params: { missing: 'project' } });
  }
  if (!pRes.value.trusted) {
    return sendError(reply, { code: 'E011', params: { reason: 'untrusted' } });
  }
  const parsed = ChatImageUploadSchema.safeParse(request.body);
  if (!parsed.success) {
    return sendError(reply, { code: 'E016' });
  }
  const buffer = Buffer.from(parsed.data.dataBase64, 'base64');
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const saveRes = await deps.chatImages.save(pRes.value.id, parsed.data.kind, bytes);
  if (!saveRes.ok) {
    return sendError(reply, saveRes.error);
  }
  reply.status(201);
  return { data: { id: saveRes.value.id } };
}

export function registerAgentTurnRoutes(api: FastifyInstance, deps: AgentTurnRoutesDeps): void {
  api.post('/agent/images', { bodyLimit: 8 * 1024 * 1024 }, (req, rep) =>
    handlePostImage(deps, req, rep),
  );

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
