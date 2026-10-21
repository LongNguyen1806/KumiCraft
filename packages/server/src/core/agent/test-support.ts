// Test setup and helpers for turn runner (WP-3.03b).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ProjectInfo } from '@reactcraft/shared';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import { createNodeProcess } from '../../adapters/system/node-process.ts';
import { createJobService, type JobService } from '../jobs/job-service.ts';
import { createMirrorService } from '../mirror/mirror-service.ts';
import type { MirrorService } from '../mirror/mirror-types.ts';
import { createEventBus, type EventBusPort, type ServerEvent } from '../ports/event-bus-port.ts';
import { ok, type Result } from '../shared/result.ts';
import { toSupportedPlatform } from '../shared/session.ts';
import type { Settings } from '../shared/user-config.ts';
import { silentLogger } from '../workspace/test-support.ts';
import { agyAdapter } from './adapters/agy.ts';
import { claudeAdapter } from './adapters/claude.ts';
import { type AgentService, createAgentService } from './agent-service.ts';
import { createTurnSnapshotStore } from './snapshot/snapshot-store.ts';
import type { TurnSnapshotStore } from './snapshot/snapshot-types.ts';
import { createTurnRunner, type TurnRunner } from './turn-runner.ts';
import { createTurnStore, type TurnStore } from './turn-store.ts';

export const FAKE_AGENT_PATH = fileURLToPath(
  new URL('../../../test-support/fake-agent.mjs', import.meta.url),
);
export const SCRIPTS_DIR = fileURLToPath(
  new URL('../../../test-support/agent-scripts', import.meta.url),
);

const platform = toSupportedPlatform(process.platform) ?? 'linux';
export const realFs = createNodeFileSystem(platform);
export const proc = createNodeProcess();

export type TestTurnEnv = {
  readonly projectRoot: string;
  readonly dataDir: string;
  readonly cacheDir: string;
  readonly eventBus: EventBusPort;
  readonly jobs: JobService;
  readonly mirror: MirrorService;
  readonly snapshots: TurnSnapshotStore;
  readonly store: TurnStore;
  readonly turnRunner: TurnRunner;
};

export async function writeTestProjectFiles(
  projectRoot: string,
  dataDir?: string,
  cacheDir?: string,
): Promise<void> {
  await mkdir(join(projectRoot, 'src'), { recursive: true });
  await writeFile(join(projectRoot, 'src/App.tsx'), '// initial App\nexport function App() {}\n');
  await writeFile(join(projectRoot, 'src/main.tsx'), '// initial main\n');
  if (dataDir !== undefined) {
    await mkdir(dataDir, { recursive: true });
  }
  if (cacheDir !== undefined) {
    await mkdir(cacheDir, { recursive: true });
  }
}

export function makeTestProjectInfo(
  projectRoot: string,
  overrides: Partial<ProjectInfo> = {},
): ProjectInfo {
  return {
    id: 'p_12345678',
    name: 'test-project',
    root: projectRoot,
    sourceDir: 'src',
    trusted: true,
    needsInstall: false,
    responsiveMode: 'desktop-first',
    frames: [{ id: 'desktop', label: 'Desktop', width: 1200, height: 800 }],
    primaryFrameId: 'desktop',
    designDirs: {
      pages: 'src/pages',
      layouts: 'src/layouts',
      components: 'src/components',
      drafts: 'src/drafts',
    },
    backends: [],
    support: {
      supported: true,
      reasons: [],
      framework: 'vite-react',
      versions: {},
      language: 'ts',
    },
    ...overrides,
  };
}

export type SetupTurnRunnerOptions = {
  readonly projectInfo?: ProjectInfo | undefined;
  readonly projectError?: Result<ProjectInfo> | undefined;
  readonly snapshotMaxBytes?: number | undefined;
  readonly timeoutMs?: number | undefined;
  readonly keepTurns?: number | undefined;
  readonly customMirror?: Pick<MirrorService, 'refresh' | 'check'> | undefined;
  readonly userSettings?: Settings | undefined;
};

const defaultSettings: Settings = {
  language: 'vi',
  editor: 'vscode',
  agent: { preferred: 'auto' },
};

let lastSpawnedPid: number | undefined;

export function getLastSpawnedPid(): number | undefined {
  return lastSpawnedPid;
}

function createTestAgentService(settings?: Settings): AgentService {
  return createAgentService({
    process: proc,
    settings: () => settings ?? defaultSettings,
    adapters: { agy: agyAdapter, claude: claudeAdapter },
    commands: {
      agy: { command: process.execPath, prefixArgs: [FAKE_AGENT_PATH] },
      claude: { command: 'non-existent-claude-command-xyz', prefixArgs: [] },
    },
  });
}

export function setupTurnRunnerTest(
  baseDir: string,
  options: SetupTurnRunnerOptions = {},
): TestTurnEnv {
  const projectRoot = join(baseDir, 'project');
  const dataDir = join(baseDir, 'data');
  const cacheDir = join(baseDir, 'cache');

  const eventBus = createEventBus();
  const jobs = createJobService({
    system: { now: () => new Date() },
    logger: silentLogger,
    eventBus,
  });

  const agentService = createTestAgentService(options.userSettings);
  const mirror = createMirrorService({ fs: realFs, cacheDir, logger: silentLogger });
  const snapshots = createTurnSnapshotStore(
    { fs: realFs, dataDir, logger: silentLogger },
    options.snapshotMaxBytes !== undefined ? { maxBytes: options.snapshotMaxBytes } : {},
  );
  const store = createTurnStore(
    { fs: realFs, dataDir },
    options.keepTurns !== undefined ? { keepTurns: options.keepTurns } : {},
  );

  const getProject = (): Result<ProjectInfo> =>
    options.projectError ?? ok(options.projectInfo ?? makeTestProjectInfo(projectRoot));

  const trackingProc = {
    spawn: (cmd: string, args: readonly string[], opts: Parameters<typeof proc.spawn>[2]) => {
      const handle = proc.spawn(cmd, args, opts);
      lastSpawnedPid = handle.pid;
      return handle;
    },
  };

  const turnRunner = createTurnRunner({
    fs: realFs,
    process: trackingProc,
    jobs,
    agents: agentService,
    mirror: options.customMirror ?? mirror,
    snapshots,
    store,
    project: getProject,
    eventBus,
    logger: silentLogger,
    now: () => new Date(),
    timeoutMs: options.timeoutMs,
  });

  return { projectRoot, dataDir, cacheDir, eventBus, jobs, mirror, snapshots, store, turnRunner };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && Boolean(value);
}

const JOB_END_TYPES: readonly string[] = ['job.completed', 'job.failed', 'job.cancelled'];

export function waitForJobEnd(eventBus: EventBusPort, jobId: string): Promise<ServerEvent> {
  return new Promise((resolve) => {
    const unsubscribe = eventBus.subscribe((event) => {
      if (
        JOB_END_TYPES.includes(event.type) &&
        isRecord(event.payload) &&
        event.payload['jobId'] === jobId
      ) {
        unsubscribe();
        resolve(event);
      }
    });
  });
}

export function waitForFirstAgentEvent(eventBus: EventBusPort, turnId: string): Promise<void> {
  return new Promise((resolve) => {
    const unsubscribe = eventBus.subscribe((event) => {
      if (
        event.type === 'agent.event' &&
        isRecord(event.payload) &&
        event.payload['turnId'] === turnId
      ) {
        unsubscribe();
        resolve();
      }
    });
  });
}
