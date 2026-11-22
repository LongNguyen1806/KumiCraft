// Public entry point of @kumicraft/server (QC-03): composition root of the Local Server.
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import envPaths from 'env-paths';

import { createNodeFileSystem } from './adapters/fs/node-file-system.ts';
import { createAppLog } from './adapters/log/app-log.ts';
import { type LegacyDirPair, moveLegacyUserDirs } from './adapters/system/legacy-user-dirs.ts';
import { startMachineProbe } from './adapters/system/machine-info.ts';
import { createNodeProcess } from './adapters/system/node-process.ts';
import { createNodeSystem } from './adapters/system/node-system.ts';
import { createChokidarWatcher } from './adapters/watcher/chokidar-watcher.ts';
import type { HistoryService } from './kernel/history/history-service.ts';
import { err, ok, type Result } from './kernel/result.ts';
import { type Platform, toSupportedPlatform } from './kernel/session.ts';
import { createEventBus, type EventBusPort } from './ports/event-bus-port.ts';
import type { LoggerPort } from './ports/logger-port.ts';
import type { ProcessPort } from './ports/process-port.ts';
import {
  type InitializedContext,
  resolveRunnerScript,
  type StartServerOptions,
} from './server-config.ts';
import { autoOpenProject, createHttpServer } from './server-http.ts';
import { type CoreServices, createServices } from './server-services.ts';
import type { AgentService } from './services/agent/agent-service.ts';
import type { TurnSnapshotStore } from './services/agent/snapshot/index.ts';
import type { TurnRunner } from './services/agent/turn-runner.ts';
import { loadSessionToken } from './services/config/session-token-store.ts';
import { type ConfigStore, createConfigStore } from './services/config/user-config.ts';
import type { JobService } from './services/jobs/job-service.ts';
import type { ProjectService } from './services/project/project-service.ts';
import type { RunnerService } from './services/runner/runner-service.ts';
import { writeReportingFileSystem } from './services/runner/write-notifier.ts';
import { readRememberedPort } from './services/workspace/studio-port.ts';
import { STACKS } from './stacks/index.ts';
import { styleThemeTokens } from './stacks/style/index.ts';
import type { SourceEditorService } from './stacks/view/jsx/source-editor-service.ts';

export type { LogLevel } from './adapters/http/create-http-app.ts';
export type { HistoryService } from './kernel/history/history-service.ts';
export type { AppError, ErrorCode, Result } from './kernel/result.ts';
export type { Platform, ProjectState, SessionInfo } from './kernel/session.ts';
export type { EventBusPort, ServerEvent } from './ports/event-bus-port.ts';
export type { AgentService } from './services/agent/agent-service.ts';
export type { AgentCommand } from './services/agent/agent-types.ts';
export type { TurnSnapshotStore } from './services/agent/snapshot/index.ts';
export type { TurnRunner } from './services/agent/turn-runner.ts';
export type { TurnStore } from './services/agent/turn-store.ts';
export { parseSessionToken, SESSION_FILE } from './services/config/session-token-store.ts';
export type { ProjectService } from './services/project/project-service.ts';
export type { RunnerService } from './services/runner/runner-service.ts';
export { LOCK_FILE, type LockInfo, parseLock } from './services/workspace/lock.ts';
export type { SourceEditorService } from './stacks/view/jsx/source-editor-service.ts';

/** ADR-BE-03: the server never listens on another interface. */
export const HOST = '127.0.0.1';

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

/**
 * On a computer that never ran KumiCraft the config folder does not exist, and saving settings
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

/** Old-name folders move only into the real user folders, never into ones passed in (tests). */
function legacyDirPairs(options: StartServerOptions): LegacyDirPair[] {
  const old = envPaths('reactcraft');
  const now = envPaths('kumicraft');
  const given = options.deps;
  return [
    ...(given?.configDir === undefined ? [{ from: old.config, to: now.config }] : []),
    ...(given?.dataDir === undefined ? [{ from: old.data, to: now.data }] : []),
    ...(given?.cacheDir === undefined ? [{ from: old.cache, to: now.cache }] : []),
  ];
}

/** Folders of the old name move first, then each folder the server writes to exists. */
async function prepareUserDirs(
  options: StartServerOptions,
  dirs: { readonly configDir: string; readonly cacheDir: string; readonly dataDir: string },
  logger: LoggerPort,
): Promise<void> {
  await moveLegacyUserDirs(legacyDirPairs(options), logger);
  await ensureConfigDir(dirs.configDir, logger);
  await ensureMirrorsDir(dirs.cacheDir, logger);
  await ensureTurnsDir(dirs.dataDir, logger);
}

function resolveServerPaths(options: StartServerOptions) {
  return {
    configDir: options.deps?.configDir ?? envPaths('kumicraft').config,
    cacheDir: options.deps?.cacheDir ?? envPaths('kumicraft').cache,
    dataDir: options.deps?.dataDir ?? envPaths('kumicraft').data,
    homeDir: options.deps?.homeDir ?? homedir(),
    templateDir: options.deps?.templateDir ?? resolveTemplateDir(),
  };
}

function resolveCorePorts(options: StartServerOptions, platform: Platform) {
  // KumiCraft's writes reach the dev server too, once the runner exists (K9.5).
  const writes = writeReportingFileSystem(options.deps?.fs ?? createNodeFileSystem(platform));
  const log = createAppLog({ level: options.logLevel ?? 'info', ...options.deps });
  return {
    fs: writes.fs,
    connectWrites: writes.connect,
    logger: log.port,
    pino: log.pino,
    system: options.deps?.system ?? createNodeSystem(),
    processPort: options.deps?.process ?? createNodeProcess(),
    eventBus: options.deps?.eventBus ?? createEventBus(),
  };
}

/** Passes KumiCraft's writes to the runner (K9.5), then opens the project given at start. */
function connectAndOpen(
  ports: ReturnType<typeof resolveCorePorts>,
  services: CoreServices,
  workspaceDir: string | undefined,
): ReturnType<typeof autoOpenProject> {
  ports.connectWrites(services.runnerService.notifyWritten);
  return autoOpenProject(ports.fs, services.projectService, workspaceDir);
}

/** The user config serves the settings, the trusted projects and the recent list (R-PJ-25). */
function configDeps(configStore: ConfigStore) {
  return { config: configStore, recents: configStore };
}

/** Service options the CLI does not pass: test agent commands and the Prettier child (M-FM). */
function childScriptDeps(options: StartServerOptions) {
  return {
    agentCommands: options.deps?.agentCommands,
    formatScriptPath: resolveRunnerScript(undefined, 'format-snippet'),
    propTypesScriptPath: resolveRunnerScript(undefined, 'prop-types'),
  };
}

async function initServerContext(
  options: StartServerOptions,
  platform: Platform,
): Promise<Result<InitializedContext>> {
  const ports = resolveCorePorts(options, platform);
  const { fs, logger, system, processPort, eventBus } = ports;
  const { configDir, cacheDir, dataDir, homeDir, templateDir } = resolveServerPaths(options);
  await prepareUserDirs(options, { configDir, cacheDir, dataDir }, logger);
  const configStore = await createConfigStore({ fs, dir: configDir, platform, logger });
  const services = createServices(
    {
      fs,
      system,
      process: processPort,
      ...configDeps(configStore),
      logger,
      installedPackageManager: machineProbe(options, processPort, logger),
      eventBus,
      port: options.port,
      platform,
      homeDir,
      templateDir,
      initialRoot: options.workspaceDir,
      stacks: STACKS,
      themeTokens: styleThemeTokens,
      cacheDir,
      dataDir,
      ...childScriptDeps(options),
    },
    studioOriginOf(options),
    processPort,
    eventBus,
    fs,
    options.deps?.watcher ?? createChokidarWatcher(),
    resolveRunnerScript(options.deps?.runnerScriptPath),
    (entry: string) => resolveRunnerScript(undefined, entry),
  );

  const autoOpen = await connectAndOpen(ports, services, options.workspaceDir);
  if (!autoOpen.ok) return autoOpen;

  return ok({ ...services, ...ports, configStore, platform, homeDir, configDir, cacheDir });
}

/** The real computer only: a test's fake process answers no `--version`. */
function machineProbe(options: StartServerOptions, processPort: ProcessPort, logger: LoggerPort) {
  return options.deps?.process === undefined
    ? startMachineProbe(processPort, logger, options.version)
    : undefined;
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

export { type InitializedContext, resolveRunnerScript, type StartServerOptions };
