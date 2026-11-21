// Common error response of SPEC-03 section 4.1. `cause` never leaves the server (QC-51).
import type { FastifyReply } from 'fastify';

import { type AppError, HTTP_STATUS_BY_CODE } from '../../core/shared/result.ts';

/**
 * Sends `error` with the HTTP status of its code, or with `status` when a measure requires another
 * one (for example 421 for a wrong Host, SPEC-05 S-04).
 */
/** E012 is logged below with its path only; E015 (not found) is an ordinary lookup answer. */
const QUIET_CODES = new Set<string>(['E012', 'E015']);

export function sendError(reply: FastifyReply, error: AppError, status?: number): FastifyReply {
  const httpStatus = status ?? HTTP_STATUS_BY_CODE[error.code];
  if (httpStatus >= 500) {
    // The cause stays here: the log is the only place a server failure can be diagnosed.
    reply.request.log.error(
      { code: error.code, params: error.params, err: error.cause },
      'request failed',
    );
  }
  if (httpStatus < 500 && !QUIET_CODES.has(error.code)) {
    // What the user was told, and on which request: the log file sent back with a bug report.
    reply.request.log.warn(
      { code: error.code, params: error.params, url: reply.request.routeOptions.url },
      'request refused',
    );
  }
  if (error.code === 'E012') {
    // S-26: a refused path is logged with the normalized path only, never file content.
    reply.request.log.warn(
      { code: error.code, path: error.params?.['path'], reason: error.params?.['reason'] },
      'path refused',
    );
  }
  return reply.status(httpStatus).send({
    error: {
      code: error.code,
      params: error.params,
      details: error.details ?? [],
      requestId: reply.request.id,
    },
  });
}
