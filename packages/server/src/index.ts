// Public entry point of @reactcraft/server (QC-03): composition root of the Local Server.
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

import { resolveEnabledFeatures } from '@reactcraft/shared';
import envPaths from 'env-paths';
import type { FastifyInstance } from 'fastify';

import { createNodeFileSystem } from './adapters/fs/node-file-system.ts';
import { createHttpApp, type LogLevel } from './adapters/http/create-http-app.ts';
import { createServerLogger } from './adapters/log/create-logger.ts';
import { createNodeSystem } from './adapters/system/node-system.ts';
import { createEventBus, type EventBusPort } from './core/ports/event-bus-port.ts';
import type { FileSystemPort } from './core/ports/file-system-port.ts';
import type { LoggerPort } from './core/ports/logger-port.ts';
import type { SystemPort } from './core/ports/system-port.ts';
import { err, ok, type Result } from './core/shared/result.ts';
import {
  createSessionInfoProvider,
  type Platform,
  toSupportedPlatform,
} from './core/shared/session.ts';
import { type ConfigStore, createConfigStore } from './core/shared/user-config.ts';
import { createProjectReader } from './core/workspace/project-reader.ts';
import { readRememberedPort } from './core/workspace/studio-port.ts';
import {
  createWorkspaceService,
  type WorkspaceService,
} from './core/workspace/workspace-service.ts';

export type { LogLevel } from './adapters/http/create-http-app.ts';
export type { EventBusPort, ServerEvent } from './core/ports/event-bus-port.ts';
export type { AppError, ErrorCode, Result } from './core/shared/result.ts';
export type { Platform, ProjectState, SessionInfo } from './core/shared/session.ts';
export type { WorkspaceService } from './core/workspace/workspace-service.ts';

/** ADR-BE-03: the server never listens on another interface. */
export const HOST = '127.0.0.1';

export type StartServerOptions = {
  /** Version of the published `reactcraft` package, shown by the Studio. */
  readonly version: string;
  /** Port chosen by the CLI (S-02). */
  readonly port: number;
  /** Absolute path of the folder given to the CLI. */
  readonly workspaceDir: string;
  /** Absolute path of the built Studio. Omit to serve the API only (Studio dev server). */
  readonly studioDir?: string;
  readonly logLevel?: LogLevel;
  /** Value of `REACTCRAFT_FEATURES`. */
  readonly featureOverride?: string;
  /** Origins trusted like the server's own: only the Vite dev server of `pnpm dev`. */
  readonly trustedOrigins?: readonly string[];
  /** Optional dependency overrides for testing. */
  readonly deps?: {
    readonly fs?: FileSystemPort;
    readonly system?: SystemPort;
    readonly configDir?: string;
    readonly logger?: LoggerPort;
    readonly eventBus?: EventBusPort;
  };
};

export type RunningServer = {
  readonly url: string;
  readonly port: number;
  /** Session token. The CLI hands it to the Studio in the URL fragment `#t=` (SPEC-05 S-05). */
  readonly sessionToken: string;
  readonly workspaceService: WorkspaceService;
  readonly eventBus: EventBusPort;
  readonly close: () => Promise<void>;
};

type InitializedContext = {
  readonly workspaceService: WorkspaceService;
  readonly configStore: ConfigStore;
  readonly eventBus: EventBusPort;
};

/**
 * On a computer that never ran ReactCraft the config folder does not exist, and saving settings
 * would fail. A folder that cannot be made only costs saved settings.
 */
async function ensureConfigDir(dir: string, logger: LoggerPort): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
  } catch (cause) {
    logger.warn({ dir, err: cause }, 'cannot create the config folder; settings will not be saved');
  }
}

async function initServerContext(
  options: StartServerOptions,
  platform: Platform,
): Promise<Result<InitializedContext>> {
  const fs = options.deps?.fs ?? createNodeFileSystem(platform);
  const logger =
    options.deps?.logger ?? createServerLogger({ level: options.logLevel ?? 'info' }).port;
  const system = options.deps?.system ?? createNodeSystem();
  const configDir = options.deps?.configDir ?? envPaths('reactcraft').config;
  const eventBus = options.deps?.eventBus ?? createEventBus();
  await ensureConfigDir(configDir, logger);

  const configStore = await createConfigStore({ fs, dir: configDir, platform, logger });
  const workspaceService = createWorkspaceService({
    fs,
    root: options.workspaceDir,
    system,
    config: configStore,
    logger,
    port: options.port,
  });

  const opened = await workspaceService.open();
  if (!opened.ok) return opened;
  return ok({ workspaceService, configStore, eventBus });
}

function createHttpServer(
  options: StartServerOptions,
  ctx: InitializedContext,
  sessionToken: string,
): Promise<FastifyInstance> {
  const getSessionInfo = createSessionInfoProvider({
    version: options.version,
    platform: toSupportedPlatform(process.platform) ?? 'linux',
    features: resolveEnabledFeatures(options.featureOverride),
    readProject: createProjectReader(ctx.workspaceService, options.workspaceDir),
  });

  return createHttpApp({
    logLevel: options.logLevel ?? 'info',
    security: { port: options.port, sessionToken, trustedOrigins: options.trustedOrigins ?? [] },
    getSessionInfo,
    projectRoutes: { workspaceService: ctx.workspaceService, getSessionInfo },
    settingsRoutes: { config: ctx.configStore },
    eventRoutes: { eventBus: ctx.eventBus, sessionToken },
    ...(options.studioDir === undefined ? {} : { studioDir: options.studioDir }),
  });
}

export async function startServer(options: StartServerOptions): Promise<Result<RunningServer>> {
  const platform = toSupportedPlatform(process.platform);
  if (platform === undefined) {
    return err({ code: 'E002', params: { step: 'platform', platform: process.platform } });
  }

  const contextRes = await initServerContext(options, platform);
  if (!contextRes.ok) return contextRes;
  const ctx = contextRes.value;

  const sessionToken = randomBytes(32).toString('base64url');
  const app = await createHttpServer(options, ctx, sessionToken);
  try {
    await app.listen({ host: HOST, port: options.port });
  } catch (cause) {
    await ctx.workspaceService.close();
    await app.close();
    return err({ code: 'E002', params: { step: 'listen', port: options.port }, cause });
  }

  return ok({
    url: `http://${HOST}:${String(options.port)}`,
    port: options.port,
    sessionToken,
    workspaceService: ctx.workspaceService,
    eventBus: ctx.eventBus,
    close: async () => {
      await ctx.workspaceService.close();
      await app.close();
    },
  });
}

/**
 * Port of the last session in `workspaceDir`, if it is a dynamic port (SPEC-05 S-02). The CLI tries
 * it first so the Studio keeps its address.
 */
export async function lastStudioPort(workspaceDir: string): Promise<number | undefined> {
  const platform = toSupportedPlatform(process.platform);
  if (platform === undefined) return undefined;
  return readRememberedPort(createNodeFileSystem(platform), workspaceDir);
}
