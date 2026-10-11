// Common error response of SPEC-03 section 9.2. `cause` never leaves the server (QC-51).
import type { FastifyReply } from 'fastify';

import { type AppError, HTTP_STATUS_BY_CODE } from '../../core/shared/result.ts';

/**
 * Sends `error` with the HTTP status of its code, or with `status` when a measure requires another
 * one (for example 421 for a wrong Host, SPEC-05 S-04).
 */
export function sendError(reply: FastifyReply, error: AppError, status?: number): FastifyReply {
  return reply.status(status ?? HTTP_STATUS_BY_CODE[error.code]).send({
    error: {
      code: error.code,
      params: error.params,
      details: error.details ?? [],
      requestId: reply.request.id,
    },
  });
}
