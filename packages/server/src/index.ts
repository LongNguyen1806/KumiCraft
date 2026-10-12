// Public entry point of @reactcraft/server (QC-03): composition root of the Local Backend.
import { randomBytes } from 'node:crypto';

import { type DesignDocument, resolveEnabledFeatures } from '@reactcraft/model';
import envPaths from 'env-paths';
import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';

import { createNodeFileSystem } from './adapters/fs/node-file-system.ts';
import { createHttpApp, type LogLevel } from './adapters/http/create-http-app.ts';
import { createServerLogger } from './adapters/log/create-logger.ts';
import { createNodeSystem } from './adapters/system/node-system.ts';
import {
  createWorkspaceWatcher,
  type WorkspaceWatcher,
} from './adapters/watcher/workspace-watcher.ts';
import { createDesignStore, type DesignStore } from './core/design-store/design-store.ts';
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
import { readRememberedPort } from './core/workspace/studio-port.ts';
import { createWorkspaceReader } from './core/workspace/workspace-reader.ts';
import {
  createWorkspaceService,
  type WorkspaceService,
} from './core/workspace/workspace-service.ts';

export type { LogLevel } from './adapters/http/create-http-app.ts';
export type { DesignStore } from './core/design-store/design-store.ts';
export type { EventBusPort, ServerEvent } from './core/ports/event-bus-port.ts';
export type { AppError, ErrorCode, Result } from './core/shared/result.ts';
export type { Platform, SessionInfo, WorkspaceState } from './core/shared/session.ts';
export type { WorkspaceService } from './core/workspace/workspace-service.ts';

/** ADR-BE-03: the server never listens on another interface. */
export const HOST = '127.0.0.1';

export type StartServerOptions = {
  /** Version of the published `reactcraft` package, shown by the Studio. */
  readonly version: string;
  /** Port chosen by the CLI (S-02). */
  readonly port: number;
  /** Absolute path of the workspace directory. */
  readonly workspaceDir: string;
  /** Absolute path of the built Studio. Omit to serve the API only (Studio dev server). */
  readonly studioDir?: string;
  readonly logLevel?: LogLevel;
  /** Value of `REACTCRAFT_FEATURES` (SPEC-07 CW-17). */
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
  /** Session token. The CLI hands it to the Studio in the URL fragment `#t=` (SPEC-05 section 5.2). */
  readonly sessionToken: string;
  readonly workspaceService: WorkspaceService;
  readonly getDesignStore: () => DesignStore | undefined;
  readonly eventBus: EventBusPort;
  readonly close: () => Promise<void>;
};

type InitializedContext = {
  readonly fs: FileSystemPort;
  readonly logger: LoggerPort;
  readonly system: SystemPort;
  readonly workspaceService: WorkspaceService;
  readonly configStore: ConfigStore;
  readonly eventBus: EventBusPort;
};

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

  const configStore = await createConfigStore({
    fs,
    dir: configDir,
    platform,
    env: process.env,
    logger,
  });

  const workspaceService = createWorkspaceService({
    fs,
    root: options.workspaceDir,
    system,
    config: configStore,
    logger,
    port: options.port,
    newId: (size) => nanoid(size),
  });

  const opened = await workspaceService.open();
  if (!opened.ok) return opened;

  return ok({ fs, logger, system, workspaceService, configStore, eventBus });
}

function createHttpServer(
  options: StartServerOptions,
  ctx: InitializedContext,
  getStore: () => DesignStore | undefined,
  setStore: (s: DesignStore | undefined) => void,
  makeStore: (doc: DesignDocument, rev: number) => DesignStore,
  sessionToken: string,
): Promise<FastifyInstance> {
  const getSessionInfo = createSessionInfoProvider({
    version: options.version,
    platform: toSupportedPlatform(process.platform) ?? 'linux',
    features: resolveEnabledFeatures(options.featureOverride),
    readWorkspace: createWorkspaceReader(ctx.workspaceService, getStore, options.workspaceDir),
  });

  return createHttpApp({
    logLevel: options.logLevel ?? 'info',
    security: { port: options.port, sessionToken, trustedOrigins: options.trustedOrigins ?? [] },
    getSessionInfo,
    workspaceRoutes: {
      workspaceService: ctx.workspaceService,
      getDesignStore: getStore,
      setDesignStore: setStore,
      createDesignStore: makeStore,
      getSessionInfo,
      fs: ctx.fs,
      root: options.workspaceDir,
    },
    settingsRoutes: { config: ctx.configStore },
    eventRoutes: {
      eventBus: ctx.eventBus,
      sessionToken,
    },
    ...(options.studioDir === undefined ? {} : { studioDir: options.studioDir }),
  });
}

async function listenOnPort(
  app: FastifyInstance,
  port: number,
  ctx: InitializedContext,
  getStore: () => DesignStore | undefined,
): Promise<Result<void>> {
  try {
    await app.listen({ host: HOST, port });
    return ok(undefined);
  } catch (cause) {
    const currentStore = getStore();
    if (currentStore) await currentStore.flush();
    await ctx.workspaceService.close();
    await app.close();
    return err({ code: 'E002', params: { step: 'listen', port }, cause });
  }
}

type StoreManager = {
  getStore: () => DesignStore | undefined;
  setStore: (s: DesignStore | undefined) => void;
  makeStore: (doc: DesignDocument, rev: number) => DesignStore;
  close: () => Promise<void>;
};

function createStoreManager(options: StartServerOptions, ctx: InitializedContext): StoreManager {
  let currentStore: DesignStore | undefined;
  let watcher: WorkspaceWatcher | undefined;

  const startWatcher = () => {
    if (watcher === undefined) {
      watcher = createWorkspaceWatcher({
        root: options.workspaceDir,
        getStore: () => currentStore,
        eventBus: ctx.eventBus,
        logger: ctx.logger,
      });
    }
  };

  const makeStore = (doc: DesignDocument, rev: number) => {
    const store = createDesignStore({
      fs: ctx.fs,
      root: options.workspaceDir,
      system: ctx.system,
      logger: ctx.logger,
      initialDocument: doc,
      initialRevision: rev,
      eventBus: ctx.eventBus,
    });
    startWatcher();
    return store;
  };

  const wsState = ctx.workspaceService.state();
  if (wsState.status === 'open') {
    currentStore = makeStore(wsState.document, wsState.document.workspace.revision);
  }

  return {
    getStore: () => currentStore,
    setStore: (s) => {
      currentStore = s;
    },
    makeStore,
    close: async () => {
      if (watcher) await watcher.close();
      if (currentStore) await currentStore.flush();
    },
  };
}

export async function startServer(options: StartServerOptions): Promise<Result<RunningServer>> {
  const platform = toSupportedPlatform(process.platform);
  if (platform === undefined) {
    return err({ code: 'E002', params: { step: 'platform', platform: process.platform } });
  }

  const contextRes = await initServerContext(options, platform);
  if (!contextRes.ok) return contextRes;
  const ctx = contextRes.value;

  const storeManager = createStoreManager(options, ctx);
  const sessionToken = randomBytes(32).toString('base64url');
  const app = await createHttpServer(
    options,
    ctx,
    storeManager.getStore,
    storeManager.setStore,
    storeManager.makeStore,
    sessionToken,
  );

  const listenRes = await listenOnPort(app, options.port, ctx, storeManager.getStore);
  if (!listenRes.ok) return listenRes;

  return ok({
    url: `http://${HOST}:${String(options.port)}`,
    port: options.port,
    sessionToken,
    workspaceService: ctx.workspaceService,
    getDesignStore: storeManager.getStore,
    eventBus: ctx.eventBus,
    close: async () => {
      await storeManager.close();
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
