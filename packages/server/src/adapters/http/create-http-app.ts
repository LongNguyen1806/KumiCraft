// Fastify application: API under /api/v1, the built Studio as static files on the same origin
// (ADR-BE-03, ADR-BE-06, SPEC-03 section 9).
import { randomBytes } from 'node:crypto';

import fastifyStatic from '@fastify/static';
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  LogController,
} from 'fastify';

import type { SessionInfo } from '../../core/shared/session.ts';
import { registerSessionRoutes } from './routes/session.ts';
import { registerSecurity, type SecurityOptions } from './security.ts';
import { sendError } from './send-error.ts';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export type HttpAppOptions = {
  readonly logLevel: LogLevel;
  readonly security: SecurityOptions;
  readonly getSessionInfo: () => SessionInfo;
  /** Directory of the built Studio. When absent, only the API is served. */
  readonly studioDir?: string;
};

const API_PREFIX = '/api/v1';
const BODY_LIMIT_BYTES = 10 * 1024 * 1024;

// ADR-BE-23: never log the session token, wherever a client puts it.
const REDACTED_PATHS = ['req.headers.authorization', 'req.headers["sec-websocket-protocol"]'];

const createRequestId = (): string => `req_${randomBytes(8).toString('base64url')}`;

function handleError(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const status = error.statusCode ?? 500;
  // Fastify reports malformed JSON, oversized bodies and similar client mistakes with a 4xx code.
  if (status >= 400 && status < 500) {
    return sendError(reply, { code: 'E016', params: { reason: error.code } });
  }
  request.log.error({ err: error }, 'unhandled error');
  return sendError(reply, { code: 'E013' });
}

export async function createHttpApp(options: HttpAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: options.logLevel, redact: REDACTED_PATHS },
    bodyLimit: BODY_LIMIT_BYTES,
    genReqId: createRequestId,
    requestIdHeader: false,
    logController: new LogController({ disableRequestLogging: true }),
  });

  app.addHook('onRequest', (request, reply, done) => {
    void reply.header('X-Request-Id', request.id);
    done();
  });
  registerSecurity(app, options.security);
  app.setErrorHandler(handleError);

  await app.register(
    (api, _opts, done) => {
      registerSessionRoutes(api, options.getSessionInfo);
      done();
    },
    { prefix: API_PREFIX },
  );

  const { studioDir } = options;
  if (studioDir !== undefined) {
    await app.register(fastifyStatic, { root: studioDir });
  }

  app.setNotFoundHandler((request, reply) => {
    const isStudioPage =
      studioDir !== undefined && request.method === 'GET' && !request.url.startsWith('/api/');
    // Client-side routes of the Studio all load index.html.
    if (isStudioPage) {
      return reply.sendFile('index.html');
    }
    return sendError(reply, { code: 'E015', params: { resource: 'route' } });
  });

  return app;
}
