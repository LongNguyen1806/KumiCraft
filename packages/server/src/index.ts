// Public entry point of @reactcraft/server (QC-03): composition root of the Local Server.
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AgentId } from '@reactcraft/shared';
import envPaths from 'env-paths';

import { createNodeFileSystem } from './adapters/fs/node-file-system.ts';
import type { LogLevel } from './adapters/http/create-http-app.ts';
import { createServerLogger } from './adapters/log/create-logger.ts';
import { createNodeProcess } from './adapters/system/node-process.ts';
import { createNodeSystem } from './adapters/system/node-system.ts';
import { createChokidarWatcher } from './adapters/watcher/chokidar-watcher.ts';
import type { AgentService } from './core/agent/agent-service.ts';
import type { AgentCommand } from './core/agent/agent-types.ts';
import type { TurnSnapshotStore } from './core/agent/snapshot/index.ts';
import type { TurnRunner } from './core/agent/turn-runner.ts';
import type { HistoryService } from './core/history/history-service.ts';
import type { JobService } from './core/jobs/job-service.ts';
import { createEventBus, type EventBusPort } from './core/ports/event-bus-port.ts';
import type { FileSystemPort } from './core/ports/file-system-port.ts';
import type { LoggerPort } from './core/ports/logger-port.ts';
import type { ProcessPort } from './core/ports/process-port.ts';
import type { SystemPort } from './core/ports/system-port.ts';
import type { WatcherPort } from './core/ports/watcher-port.ts';
import { viteReactAdapter } from './core/project/frameworks/vite-react/index.ts';
import type { ProjectService } from './core/project/project-service.ts';
import type { RunnerService } from './core/runner/runner-service.ts';
import { err, ok, type Result } from './core/shared/result.ts';
import { type Platform, toSupportedPlatform } from './core/shared/session.ts';
import { loadSessionToken } from './core/shared/session-token-store.ts';
import { type ConfigStore, createConfigStore } from './core/shared/user-config.ts';
import type { SourceEditorService } from './core/source-editor/source-editor-service.ts';
import { readRememberedPort } from './core/workspace/studio-port.ts';
import { autoOpenProject, createHttpServer } from './server-http.ts';
import { type CoreServices, createServices } from './server-services.ts';

export type { LogLevel } from './adapters/http/create-http-app.ts';
export type { AgentService } from './core/agent/agent-service.ts';
export type { AgentCommand } from './core/agent/agent-types.ts';
export type { TurnSnapshotStore } from './core/agent/snapshot/index.ts';
export type { TurnRunner } from './core/agent/turn-runner.ts';
export type { TurnStore } from './core/agent/turn-store.ts';
export type { HistoryService } from './core/history/history-service.ts';
export type { EventBusPort, ServerEvent } from './core/ports/event-bus-port.ts';
export type { ProjectService } from './core/project/project-service.ts';
export type { RunnerService } from './core/runner/runner-service.ts';
export type { AppError, ErrorCode, Result } from './core/shared/result.ts';
export type { Platform, ProjectState, SessionInfo } from './core/shared/session.ts';
export { parseSessionToken, SESSION_FILE } from './core/shared/session-token-store.ts';
export type { SourceEditorService } from './core/source-editor/source-editor-service.ts';
export { LOCK_FILE, type LockInfo, parseLock } from './core/workspace/lock.ts';

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
    readonly cacheDir?: string;
    readonly dataDir?: string;
    readonly templateDir?: string;
    readonly homeDir?: string;
    readonly logger?: LoggerPort;
    readonly eventBus?: EventBusPort;
    readonly watcher?: WatcherPort;
    readonly runnerScriptPath?: string | undefined;
    /** R-QA-12: E2E tests point the agents at `fake-agent.mjs` here, never via user env vars. */
    readonly agentCommands?: Partial<Record<AgentId, AgentCommand>> | undefined;
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
  readonly agentService: AgentService;
  readonly turnSnapshotStore: TurnSnapshotStore;
  readonly turnRunner: TurnRunner;
  readonly close: () => Promise<void>;
};

export type InitializedContext = CoreServices & {
  readonly configStore: ConfigStore;
  readonly eventBus: EventBusPort;
  readonly fs: FileSystemPort;
  readonly processPort: ProcessPort;
  readonly platform: Platform;
  readonly homeDir: string;
  readonly configDir: string;
  readonly logger: LoggerPort;
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

/** S-125: cache directory for backend mirrors with mode 0o700. */
async function ensureMirrorsDir(cacheDir: string, logger: LoggerPort): Promise<void> {
  try {
    await mkdir(join(cacheDir, 'mirrors'), { recursive: true, mode: 0o700 });
  } catch (cause) {
    logger.warn(
      { cacheDir, err: cause },
      'cannot create the mirrors folder; backend mirroring disabled',
    );
  }
}

/** S-113: data directory for agent turn snapshots with mode 0o700. */
async function ensureTurnsDir(dataDir: string, logger: LoggerPort): Promise<void> {
  try {
    await mkdir(join(dataDir, 'turns'), { recursive: true, mode: 0o700 });
  } catch (cause) {
    logger.warn({ dataDir, err: cause }, 'cannot create the turns folder; turn snapshots disabled');
  }
}

function resolveServerPaths(options: StartServerOptions) {
  return {
    configDir: options.deps?.configDir ?? envPaths('reactcraft').config,
    cacheDir: options.deps?.cacheDir ?? envPaths('reactcraft').cache,
    dataDir: options.deps?.dataDir ?? envPaths('reactcraft').data,
    homeDir: options.deps?.homeDir ?? homedir(),
    templateDir: options.deps?.templateDir ?? resolveTemplateDir(),
  };
}

function resolveCorePorts(options: StartServerOptions, platform: Platform) {
  return {
    fs: options.deps?.fs ?? createNodeFileSystem(platform),
    logger: options.deps?.logger ?? createServerLogger({ level: options.logLevel ?? 'info' }).port,
    system: options.deps?.system ?? createNodeSystem(),
    processPort: options.deps?.process ?? createNodeProcess(),
    eventBus: options.deps?.eventBus ?? createEventBus(),
  };
}

async function initServerContext(
  options: StartServerOptions,
  platform: Platform,
): Promise<Result<InitializedContext>> {
  const { fs, logger, system, processPort, eventBus } = resolveCorePorts(options, platform);
  const { configDir, cacheDir, dataDir, homeDir, templateDir } = resolveServerPaths(options);

  await ensureConfigDir(configDir, logger);
  await ensureMirrorsDir(cacheDir, logger);
  await ensureTurnsDir(dataDir, logger);
  const configStore = await createConfigStore({ fs, dir: configDir, platform, logger });

  const runnerScript = resolveRunnerScript(options.deps?.runnerScriptPath);
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
      cacheDir,
      dataDir,
      agentCommands: options.deps?.agentCommands,
    },
    studioOriginOf(options),
    processPort,
    eventBus,
    fs,
    options.deps?.watcher ?? createChokidarWatcher(),
    runnerScript,
    viteReactAdapter,
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
  const rels = [
    './runners/vite-react.js',
    './runners/vite-react.ts',
    '../runners/vite-react.js',
    '../runners/vite-react.ts',
    '../../runners/vite-react.js',
    '../../runners/vite-react.ts',
    '../../../server/src/runners/vite-react.ts',
    '../../../../packages/server/src/runners/vite-react.ts',
  ];
  for (const rel of rels) {
    const p = fileURLToPath(new URL(rel, import.meta.url));
    if (existsSync(p)) return p;
  }
  return fileURLToPath(new URL('./runners/vite-react.js', import.meta.url));
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

export type ServerCloseSteps = {
  readonly eventBus: Pick<EventBusPort, 'publish'>;
  readonly jobService: Pick<JobService, 'cancelAll'>;
  readonly runnerService: Pick<RunnerService, 'dispose'>;
  readonly projectService: Pick<ProjectService, 'close'>;
  readonly historyService: Pick<HistoryService, 'clear'>;
  readonly app: { close: () => Promise<unknown> };
  readonly flushMs?: number;
};

export function createServerClose(steps: ServerCloseSteps): () => Promise<void> {
  let closing: Promise<void> | undefined;
  const waitMs = Math.min(Math.max(steps.flushMs ?? 50, 0), 200);
  return () => {
    closing ??= (async () => {
      steps.eventBus.publish('server.shuttingDown', {});
      await new Promise<void>((r) => setTimeout(r, waitMs));
      steps.jobService.cancelAll();
      await steps.runnerService.dispose();
      await steps.projectService.close();
      steps.historyService.clear();
      await steps.app.close();
    })();
    return closing;
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
    ctx.jobService.cancelAll();
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
    agentService: ctx.agentService,
    turnSnapshotStore: ctx.turnSnapshotStore,
    turnRunner: ctx.turnRunner,
    close: createServerClose({ ...ctx, app }),
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
