// Fastify application: API under /api/v1, the built Studio as static files on the same origin
// (ADR-BE-03, ADR-BE-06, SPEC-03 section 4).
import { randomBytes } from 'node:crypto';

import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  LogController,
} from 'fastify';

import type { SessionInfo } from '../../core/shared/session.ts';
import { type AgentTurnRoutesDeps, registerAgentTurnRoutes } from './routes/agent-turns.ts';
import { type AgentRoutesDeps, registerAgentRoutes } from './routes/agents.ts';
import { type BuildCheckRoutesDeps, registerBuildCheckRoutes } from './routes/build-check.ts';
import { type EditorRoutesDeps, registerEditorRoutes } from './routes/editor.ts';
import { type EventRoutesDeps, registerEventRoutes } from './routes/events.ts';
import { type FsRoutesDeps, registerFsRoutes } from './routes/fs.ts';
import { type HistoryRoutesDeps, registerHistoryRoutes } from './routes/history.ts';
import { type JobRoutesDeps, registerJobRoutes } from './routes/jobs.ts';
import { type ProjectRoutesDeps, registerProjectRoutes } from './routes/project.ts';
import { registerRunnerRoutes, type RunnerRoutesDeps } from './routes/runner.ts';
import { registerSessionRoutes } from './routes/session.ts';
import { registerSettingsRoutes, type SettingsRoutesDeps } from './routes/settings.ts';
import { registerSourceRoutes, type SourceRoutesDeps } from './routes/source.ts';
import { registerStyleRoutes, type StyleRoutesDeps } from './routes/style.ts';
import { registerToolGapRoutes, type ToolGapRoutesDeps } from './routes/tool-gaps.ts';
import { registerSecurity, type SecurityOptions } from './security.ts';
import { sendError } from './send-error.ts';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export type HttpAppOptions = {
  readonly logLevel: LogLevel;
  readonly security: SecurityOptions;
  readonly getSessionInfo: () => SessionInfo;
  readonly projectRoutes?: ProjectRoutesDeps;
  readonly runnerRoutes?: RunnerRoutesDeps;
  readonly fsRoutes?: FsRoutesDeps;
  readonly eventRoutes?: EventRoutesDeps;
  readonly settingsRoutes?: SettingsRoutesDeps;
  readonly sourceRoutes?: SourceRoutesDeps;
  readonly styleRoutes?: StyleRoutesDeps;
  readonly historyRoutes?: HistoryRoutesDeps;
  readonly editorRoutes?: EditorRoutesDeps;
  readonly jobRoutes?: JobRoutesDeps;
  readonly buildCheckRoutes?: BuildCheckRoutesDeps;
  readonly agentRoutes?: AgentRoutesDeps;
  readonly agentTurnRoutes?: AgentTurnRoutesDeps;
  readonly toolGapRoutes?: ToolGapRoutesDeps;
  /** Directory of the built Studio. When absent, only the API is served. */
  readonly studioDir?: string;
};

const API_PREFIX = '/api/v1';
const BODY_LIMIT_BYTES = 10 * 1024 * 1024;

// ADR-BE-23: never log the session token, wherever a client puts it.
// S-36: the session token never reaches a log line.
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers["sec-websocket-protocol"]',
  '*.token',
];

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

function registerJsonParser(app: FastifyInstance): void {
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (typeof body !== 'string' || body.trim() === '') {
      // eslint-disable-next-line no-restricted-syntax -- Fastify callback requires null
      done(null, undefined);
      return;
    }
    try {
      // eslint-disable-next-line no-restricted-syntax -- Fastify callback requires null
      done(null, JSON.parse(body));
    } catch (cause) {
      const parseError = cause as Error & { statusCode?: number; code?: string };
      parseError.statusCode = 400;
      parseError.code = 'FST_ERR_CTP_INVALID_MEDIA_TYPE';
      done(parseError, undefined);
    }
  });
}

function registerNotFoundHandler(app: FastifyInstance, studioDir?: string): void {
  app.setNotFoundHandler((request, reply) => {
    const isStudioPage =
      studioDir !== undefined && request.method === 'GET' && !request.url.startsWith('/api/');
    if (isStudioPage) {
      return reply.sendFile('index.html');
    }
    return sendError(reply, { code: 'E015', params: { resource: 'route' } });
  });
}

/** Jobs and the build check that runs as one (M-BC). */
function registerJobAndCheckRoutes(api: FastifyInstance, options: HttpAppOptions): void {
  if (options.jobRoutes !== undefined) registerJobRoutes(api, options.jobRoutes);
  if (options.buildCheckRoutes !== undefined) {
    registerBuildCheckRoutes(api, options.buildCheckRoutes);
  }
}

async function registerApiRoutes(app: FastifyInstance, options: HttpAppOptions): Promise<void> {
  await app.register(
    (api, _opts, done) => {
      registerSessionRoutes(api, options.getSessionInfo);
      if (options.projectRoutes !== undefined) {
        registerProjectRoutes(api, options.projectRoutes);
      }
      if (options.runnerRoutes !== undefined) {
        registerRunnerRoutes(api, options.runnerRoutes);
      }
      if (options.fsRoutes !== undefined) {
        registerFsRoutes(api, options.fsRoutes);
      }
      if (options.settingsRoutes !== undefined) {
        registerSettingsRoutes(api, options.settingsRoutes);
      }
      if (options.sourceRoutes !== undefined) {
        registerSourceRoutes(api, options.sourceRoutes);
      }
      if (options.styleRoutes !== undefined) {
        registerStyleRoutes(api, options.styleRoutes);
      }
      if (options.historyRoutes !== undefined) {
        registerHistoryRoutes(api, options.historyRoutes);
      }
      if (options.editorRoutes !== undefined) {
        registerEditorRoutes(api, options.editorRoutes);
      }
      registerJobAndCheckRoutes(api, options);
      if (options.agentRoutes !== undefined) {
        registerAgentRoutes(api, options.agentRoutes);
      }
      if (options.agentTurnRoutes !== undefined) {
        registerAgentTurnRoutes(api, options.agentTurnRoutes);
      }
      if (options.toolGapRoutes !== undefined) {
        registerToolGapRoutes(api, options.toolGapRoutes);
      }
      if (options.eventRoutes !== undefined) {
        registerEventRoutes(api, options.eventRoutes);
      }
      done();
    },
    { prefix: API_PREFIX },
  );
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
  registerJsonParser(app);
  registerSecurity(app, options.security);
  app.setErrorHandler(handleError);

  await app.register(fastifyWebsocket, {
    options: {
      handleProtocols: (protocols) => (protocols.has('kumicraft.v1') ? 'kumicraft.v1' : false),
    },
  });

  await registerApiRoutes(app, options);

  const { studioDir } = options;
  if (studioDir !== undefined) {
    await app.register(fastifyStatic, { root: studioDir });
  }

  registerNotFoundHandler(app, studioDir);
  return app;
}
