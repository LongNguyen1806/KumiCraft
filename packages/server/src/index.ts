// Public entry point of @reactcraft/server (QC-03): composition root of the Local Server.
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import envPaths from 'env-paths';

import { createNodeFileSystem } from './adapters/fs/node-file-system.ts';
import type { LogLevel } from './adapters/http/create-http-app.ts';
import { createServerLogger } from './adapters/log/create-logger.ts';
import { createNodeProcess } from './adapters/system/node-process.ts';
import { createNodeSystem } from './adapters/system/node-system.ts';
import { createChokidarWatcher } from './adapters/watcher/chokidar-watcher.ts';
import { createHistoryService, type HistoryService } from './core/history/history-service.ts';
import { createJobService, type JobService } from './core/jobs/job-service.ts';
import { createEventBus, type EventBusPort } from './core/ports/event-bus-port.ts';
import type { FileSystemPort } from './core/ports/file-system-port.ts';
import type { LoggerPort } from './core/ports/logger-port.ts';
import type { ProcessPort } from './core/ports/process-port.ts';
import type { SystemPort } from './core/ports/system-port.ts';
import type { WatcherPort } from './core/ports/watcher-port.ts';
import { viteReactAdapter } from './core/project/frameworks/vite-react/index.ts';
import {
  createProjectService,
  type ProjectService,
  type ProjectServiceDeps,
} from './core/project/project-service.ts';
import { createProjectWatch, type ProjectWatch } from './core/project/project-watch.ts';
import { createRunnerService, type RunnerService } from './core/runner/runner-service.ts';
import { err, ok, type Result } from './core/shared/result.ts';
import { type Platform, toSupportedPlatform } from './core/shared/session.ts';
import { loadSessionToken } from './core/shared/session-token-store.ts';
import { type ConfigStore, createConfigStore } from './core/shared/user-config.ts';
import { createUsageCounter, type UsageCounter } from './core/source-editor/component-usages.ts';
import {
  createSourceEditorService,
  type SourceEditorService,
} from './core/source-editor/source-editor-service.ts';
import { readRememberedPort } from './core/workspace/studio-port.ts';
import { autoOpenProject, createHttpServer } from './server-http.ts';

export type { LogLevel } from './adapters/http/create-http-app.ts';
export type { HistoryService } from './core/history/history-service.ts';
export type { EventBusPort, ServerEvent } from './core/ports/event-bus-port.ts';
export type { ProjectService } from './core/project/project-service.ts';
export type { RunnerService } from './core/runner/runner-service.ts';
export type { AppError, ErrorCode, Result } from './core/shared/result.ts';
export type { Platform, ProjectState, SessionInfo } from './core/shared/session.ts';
export type { SourceEditorService } from './core/source-editor/source-editor-service.ts';

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
    readonly process?: ProcessPort;
    readonly configDir?: string;
    readonly templateDir?: string;
    readonly homeDir?: string;
    readonly logger?: LoggerPort;
    readonly eventBus?: EventBusPort;
    readonly watcher?: WatcherPort;
    readonly runnerScriptPath?: string | undefined;
  };
};

export type RunningServer = {
  readonly url: string;
  readonly port: number;
  /** Session token. The CLI hands it to the Studio in the URL fragment `#t=` (SPEC-05 S-05). */
  readonly sessionToken: string;
  readonly projectService: ProjectService;
  readonly runnerService: RunnerService;
  readonly sourceEditorService: SourceEditorService;
  readonly historyService: HistoryService;
  readonly eventBus: EventBusPort;
  readonly close: () => Promise<void>;
};

export type InitializedContext = {
  readonly projectService: ProjectService;
  readonly runnerService: RunnerService;
  readonly sourceEditorService: SourceEditorService;
  readonly historyService: HistoryService;
  readonly jobService: JobService;
  readonly configStore: ConfigStore;
  readonly eventBus: EventBusPort;
  readonly fs: FileSystemPort;
  readonly processPort: ProcessPort;
  readonly platform: Platform;
  readonly homeDir: string;
  readonly configDir: string;
  readonly logger: LoggerPort;
  readonly usageCounter: UsageCounter;
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
  const processPort = options.deps?.process ?? createNodeProcess();
  const configDir = options.deps?.configDir ?? envPaths('reactcraft').config;
  const eventBus = options.deps?.eventBus ?? createEventBus();
  const homeDir = options.deps?.homeDir ?? homedir();
  const templateDir = options.deps?.templateDir ?? resolveTemplateDir();

  await ensureConfigDir(configDir, logger);
  const configStore = await createConfigStore({ fs, dir: configDir, platform, logger });

  const services = createServices(
    {
      fs,
      system,
      process: processPort,
      config: configStore,
      logger,
      eventBus,
      port: options.port,
      platform,
      homeDir,
      templateDir,
      initialRoot: options.workspaceDir,
      runnerScriptPath: options.deps?.runnerScriptPath,
    },
    studioOriginOf(options),
    processPort,
    eventBus,
    fs,
    options.deps?.watcher ?? createChokidarWatcher(),
  );

  const autoOpen = await autoOpenProject(fs, services.projectService, options.workspaceDir);
  if (!autoOpen.ok) return autoOpen;

  return ok({
    ...services,
    configStore,
    eventBus,
    fs,
    processPort,
    platform,
    homeDir,
    configDir,
    logger,
  });
}

const TEMPLATE_NAME = 'vite-react-ts-tailwind4';

/**
 * Folder of the project template (ADR-BE-32): next to the built CLI (`dist/templates/`, ADR-BE-25),
 * or `templates/` of the repository when the server runs from its sources.
 */
export function resolveTemplateDir(): string {
  const candidates = [
    new URL(`./templates/${TEMPLATE_NAME}`, import.meta.url),
    new URL(`../../../templates/${TEMPLATE_NAME}`, import.meta.url),
  ].map((url) => fileURLToPath(url));
  return candidates.find((dir) => existsSync(join(dir, 'package.json'))) ?? candidates[0] ?? '';
}

export function resolveRunnerScript(customPath?: string): string {
  if (customPath && existsSync(customPath)) return customPath;
  const candidates = [
    new URL('./runners/vite-react.js', import.meta.url),
    new URL('./runners/vite-react.ts', import.meta.url),
    new URL('../runners/vite-react.js', import.meta.url),
    new URL('../runners/vite-react.ts', import.meta.url),
    new URL('../../runners/vite-react.js', import.meta.url),
    new URL('../../runners/vite-react.ts', import.meta.url),
    new URL('../../../server/src/runners/vite-react.ts', import.meta.url),
    new URL('../../../../packages/server/src/runners/vite-react.ts', import.meta.url),
  ];
  for (const candidate of candidates) {
    const p = fileURLToPath(candidate);
    if (existsSync(p)) return p;
  }
  return fileURLToPath(candidates[0] ?? new URL('./runners/vite-react.js', import.meta.url));
}

/**
 * Where the Studio page runs, the only parent the Bridge in the Canvas answers. With `pnpm dev`
 * the Studio is the Vite dev server (the trusted origin), not the server itself.
 */
export function studioOriginOf(
  options: Pick<StartServerOptions, 'port' | 'trustedOrigins'>,
): string {
  return options.trustedOrigins?.[0] ?? `http://${HOST}:${String(options.port)}`;
}

/** History, jobs and the watcher that reports files changed outside ReactCraft (R-HI-05). */
function createFileServices(
  deps: Pick<ProjectServiceDeps, 'fs' | 'system' | 'logger'>,
  eventBus: EventBusPort,
  watcher: WatcherPort,
  projectHolder: { readonly current?: ProjectService | undefined },
): { historyService: HistoryService; jobService: JobService; watch: ProjectWatch } {
  const historyService = createHistoryService({ fs: deps.fs, eventBus });
  const jobService = createJobService({ system: deps.system, logger: deps.logger, eventBus });
  const watch = createProjectWatch({
    watcher,
    fs: deps.fs,
    history: historyService,
    logger: deps.logger,
    eventBus,
    onWorkspaceFileChanged: () => projectHolder.current?.reloadWorkspaceFile() ?? Promise.resolve(),
  });
  return { historyService, jobService, watch };
}

function createProjectRunner(
  deps: Pick<ProjectServiceDeps, 'system' | 'logger'> & {
    readonly runnerScriptPath?: string | undefined;
  },
  projectService: ProjectService,
  processPort: ProcessPort,
  eventBus: EventBusPort,
  studioOrigin: string,
): RunnerService {
  return createRunnerService({
    getWorkspaceState: () => projectService.state(),
    system: deps.system,
    process: processPort,
    logger: deps.logger,
    eventBus,
    studioOrigin,
    adapter: viteReactAdapter,
    runnerScriptPath: resolveRunnerScript(deps.runnerScriptPath),
  });
}

function createServices(
  deps: Omit<ProjectServiceDeps, 'runnerService'> & {
    readonly runnerScriptPath?: string | undefined;
  },
  studioOrigin: string,
  processPort: ProcessPort,
  eventBus: EventBusPort,
  fs: FileSystemPort,
  watcher: WatcherPort,
): {
  projectService: ProjectService;
  runnerService: RunnerService;
  sourceEditorService: SourceEditorService;
  historyService: HistoryService;
  jobService: JobService;
  usageCounter: UsageCounter;
} {
  const runnerHolder: { current?: RunnerService | undefined } = {};
  const projectHolder: { current?: ProjectService | undefined } = {};
  const { historyService, jobService, watch } = createFileServices(
    deps,
    eventBus,
    watcher,
    projectHolder,
  );

  const projectService = createProjectService({
    ...deps,
    watch,
    jobs: jobService,
    history: historyService,
    runnerService: {
      start: () => runnerHolder.current?.start() ?? Promise.resolve(ok({ state: 'stopped' })),
      stop: () => runnerHolder.current?.stop() ?? Promise.resolve(ok({ state: 'stopped' })),
    },
  });
  projectHolder.current = projectService;

  const runnerService = createProjectRunner(
    deps,
    projectService,
    processPort,
    eventBus,
    studioOrigin,
  );
  const usageCounter = createUsageCounter(fs);
  const sourceEditorService = createSourceEditorService({ fs, usageCounter });
  runnerHolder.current = runnerService;

  return {
    projectService,
    runnerService,
    sourceEditorService,
    historyService,
    jobService,
    usageCounter,
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

  // S-05a: the token of the last run, so a Studio tab still open reconnects on its own.
  const sessionToken = await loadSessionToken({
    fs: ctx.fs,
    dir: ctx.configDir,
    logger: ctx.logger,
  });
  const app = await createHttpServer(options, ctx, sessionToken);
  try {
    await app.listen({ host: HOST, port: options.port });
  } catch (cause) {
    await ctx.runnerService.dispose();
    await ctx.projectService.close();
    ctx.historyService.clear();
    await app.close();
    return err({ code: 'E002', params: { step: 'listen', port: options.port }, cause });
  }

  return ok({
    url: `http://${HOST}:${String(options.port)}`,
    port: options.port,
    sessionToken,
    projectService: ctx.projectService,
    runnerService: ctx.runnerService,
    sourceEditorService: ctx.sourceEditorService,
    historyService: ctx.historyService,
    eventBus: ctx.eventBus,
    close: async () => {
      await ctx.runnerService.dispose();
      await ctx.projectService.close();
      ctx.historyService.clear();
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
