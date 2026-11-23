// Service assembly for the local server (SPEC-01 section 3.2).
import { homedir } from 'node:os';

import type { AgentId } from '@kumicraft/shared';

import {
  agentSetupPlans,
  type SetupEnvironment,
  terminalCommand,
} from './adapters/system/agent-setup-plans.ts';
import { editorByView } from './kernel/editing.ts';
import { createHistoryService, type HistoryService } from './kernel/history/history-service.ts';
import { ok } from './kernel/result.ts';
import type { EventBusPort } from './ports/event-bus-port.ts';
import type { FileSystemPort } from './ports/file-system-port.ts';
import type { ProcessPort } from './ports/process-port.ts';
import type { WatcherPort } from './ports/watcher-port.ts';
import { createRazorCodeReader } from './runners/razor/helper.ts';
import { agyAdapter } from './services/agent/adapters/agy.ts';
import { claudeAdapter } from './services/agent/adapters/claude.ts';
import { type AgentService, createAgentService } from './services/agent/agent-service.ts';
import {
  type AgentSetupService,
  createAgentSetupService,
} from './services/agent/agent-setup-service.ts';
import type { AgentCommand } from './services/agent/agent-types.ts';
import { type ChatImageStore, createChatImageStore } from './services/agent/chat-images.ts';
import {
  createTurnSnapshotStore,
  type TurnSnapshotStore,
} from './services/agent/snapshot/index.ts';
import { createToolGapStore, type ToolGapStore } from './services/agent/tool-gaps.ts';
import { createTurnRunner, type TurnRunner } from './services/agent/turn-runner.ts';
import { createTurnStore, type TurnStore } from './services/agent/turn-store.ts';
import { createJobService, type JobService } from './services/jobs/job-service.ts';
import { createMirrorService } from './services/mirror/mirror-service.ts';
import type { MirrorService } from './services/mirror/mirror-types.ts';
import {
  createProjectService,
  type ProjectService,
  type ProjectServiceDeps,
} from './services/project/project-service.ts';
import { createProjectWatch, type ProjectWatch } from './services/project/project-watch.ts';
import { attachAutoRestart } from './services/runner/runner-restart.ts';
import { createRunnerService, type RunnerService } from './services/runner/runner-service.ts';
import { createUsageCounter, type UsageCounter } from './stacks/view/jsx/component-usages.ts';
import { createSnippetFormatter } from './stacks/view/jsx/snippet-format.ts';
import {
  createSourceEditorService,
  type SourceEditorService,
} from './stacks/view/jsx/source-editor-service.ts';
import { createPugEditor } from './stacks/view/pug/editor.ts';
import { createRazorEditor } from './stacks/view/razor/editor.ts';

export type ServiceDeps = Omit<ProjectServiceDeps, 'runnerService'> & {
  readonly runnerScriptPath?: string | undefined;
  readonly cacheDir: string;
  readonly dataDir: string;
  readonly setupEnv?: SetupEnvironment | undefined;
  /** `runners/format-snippet`, the child that runs the project's Prettier (M-FM). */
  readonly formatScriptPath?: string | undefined;
  /** Test commands that replace the agents' real CLIs (R-QA-12). */
  readonly agentCommands?: Partial<Record<AgentId, AgentCommand>> | undefined;
};

export type CoreServices = {
  projectService: ProjectService;
  runnerService: RunnerService;
  sourceEditorService: SourceEditorService;
  historyService: HistoryService;
  jobService: JobService;
  mirrorService: MirrorService;
  usageCounter: UsageCounter;
  agentService: AgentService;
  agentSetupService: AgentSetupService;
  turnSnapshotStore: TurnSnapshotStore;
  turnStore: TurnStore;
  turnRunner: TurnRunner;
  chatImages: ChatImageStore;
  toolGapStore: ToolGapStore;
};

/** History, jobs and the watcher that reports files changed outside KumiCraft (R-HI-05). */
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
  deps: Pick<ProjectServiceDeps, 'system' | 'logger'>,
  runnerScript: string,
  projectService: ProjectService,
  processPort: ProcessPort,
  eventBus: EventBusPort,
  studioOrigin: string,
  resolveRunnerScript?: (entry: string) => string,
): RunnerService {
  return createRunnerService({
    getWorkspaceState: () => projectService.state(),
    system: deps.system,
    process: processPort,
    logger: deps.logger,
    eventBus,
    studioOrigin,
    getRuntime: () => projectService.getStack().runtime,
    runnerScriptPath: runnerScript,
    resolveRunnerScript,
  });
}

function createRunnerProxy(runnerHolder: { current?: RunnerService | undefined }) {
  const stopped = () => Promise.resolve(ok({ state: 'stopped' as const }));
  return {
    start: () => runnerHolder.current?.start() ?? stopped(),
    stop: () => runnerHolder.current?.stop() ?? stopped(),
  };
}

function buildFallbackCommands(
  plans: ReturnType<typeof agentSetupPlans>,
): Partial<Record<AgentId, AgentCommand>> {
  const fallbackCommands: Partial<Record<AgentId, AgentCommand>> = {};
  if (plans.agy?.fallbackCommand !== undefined) {
    fallbackCommands.agy = { command: plans.agy.fallbackCommand, prefixArgs: [] };
  }
  if (plans.claude?.fallbackCommand !== undefined) {
    fallbackCommands.claude = { command: plans.claude.fallbackCommand, prefixArgs: [] };
  }
  return fallbackCommands;
}

/** M-FM: the project's Prettier only for a trusted project, else the built-in layout. */
function createProjectSnippetFormatter(
  deps: ServiceDeps,
  processPort: ProcessPort,
  fs: FileSystemPort,
  projectService: ProjectService,
) {
  const isTrusted = () => {
    const info = projectService.getProjectInfo();
    return info.ok && info.value.trusted;
  };
  return createSnippetFormatter({
    fs,
    logger: deps.logger,
    prettier:
      deps.formatScriptPath === undefined
        ? undefined
        : { process: processPort, scriptPath: deps.formatScriptPath, isTrusted },
  });
}

/** Each view language edits with its own editor (03c section 2.1): JSX, Pug, and Razor. */
function createViewEditors(
  deps: ServiceDeps,
  processPort: ProcessPort,
  fs: FileSystemPort,
  projectService: ProjectService,
  usageCounter: UsageCounter,
): SourceEditorService {
  const styling = () => {
    const info = projectService.getProjectInfo();
    return info.ok ? info.value.support.styling : undefined;
  };
  const jsxEditor = createSourceEditorService({
    fs,
    usageCounter,
    formatSnippet: createProjectSnippetFormatter(deps, processPort, fs, projectService),
    styling,
    newCssDir: () => {
      const info = projectService.getProjectInfo();
      return info.ok ? info.value.styleFiles?.newCssDir : undefined;
    },
    getView: () => projectService.getStack().view,
    getProjectSourceDir: () => {
      const info = projectService.getProjectInfo();
      return info.ok ? info.value.sourceDir : undefined;
    },
  });
  const razorCode = createRazorCodeReader();
  return editorByView(() => projectService.getStack().view.id, {
    default: jsxEditor,
    pug: createPugEditor({ fs, styling }),
    razor: createRazorEditor({
      fs,
      codeRanges: (root, file, text) => razorCode.codeRanges(root, file, text),
      styling,
    }),
  });
}

function createAuxiliaryServices(
  deps: ServiceDeps,
  processPort: ProcessPort,
  fs: FileSystemPort,
  projectService: ProjectService,
) {
  const setupEnv = deps.setupEnv ?? {
    platform: process.platform,
    env: process.env,
    homeDir: homedir(),
  };
  const plans = agentSetupPlans(setupEnv);
  const fallbackCommands = buildFallbackCommands(plans);
  const terminalAvailable = terminalCommand(setupEnv, '') !== undefined;
  const usageCounter = createUsageCounter(fs);
  const sourceEditorService = createViewEditors(
    deps,
    processPort,
    fs,
    projectService,
    usageCounter,
  );
  const agentService = createAgentService({
    process: processPort,
    settings: () => deps.config.settings(),
    adapters: { agy: agyAdapter, claude: claudeAdapter },
    commands: deps.agentCommands,
    fallbackCommands,
    plans,
    terminalAvailable,
  });
  const turnSnapshotStore = createTurnSnapshotStore({
    fs,
    dataDir: deps.dataDir,
    logger: deps.logger,
  });
  return { usageCounter, sourceEditorService, agentService, turnSnapshotStore, plans, setupEnv };
}

function createAgentTurnServices(
  deps: ServiceDeps,
  fs: FileSystemPort,
  processPort: ProcessPort,
  jobService: JobService,
  mirrorService: MirrorService,
  projectService: ProjectService,
  eventBus: EventBusPort,
  auxiliary: { agentService: AgentService; turnSnapshotStore: TurnSnapshotStore },
) {
  const chatImages = createChatImageStore({
    fs,
    cacheDir: deps.cacheDir,
    now: () => new Date(),
  });
  const turnStore = createTurnStore({ fs, dataDir: deps.dataDir });
  const turnRunner = createTurnRunner({
    fs,
    process: processPort,
    jobs: jobService,
    agents: auxiliary.agentService,
    mirror: mirrorService,
    snapshots: auxiliary.turnSnapshotStore,
    store: turnStore,
    project: () => projectService.getProjectInfo(),
    eventBus,
    logger: deps.logger,
    now: () => new Date(),
    chatImages,
  });
  const toolGapStore = createToolGapStore({ fs, logger: deps.logger, now: () => new Date() });
  return { turnStore, turnRunner, chatImages, toolGapStore };
}

function createProjectWithWatch(
  deps: ServiceDeps,
  historyService: HistoryService,
  jobService: JobService,
  mirrorService: MirrorService,
  watch: ProjectWatch,
  runnerHolder: { current?: RunnerService | undefined },
  projectHolder: { current?: ProjectService | undefined },
): ProjectService {
  const projectService = createProjectService({
    ...deps,
    watch,
    jobs: jobService,
    history: historyService,
    mirror: mirrorService,
    runnerService: createRunnerProxy(runnerHolder),
  });
  projectHolder.current = projectService;
  return projectService;
}

function createRunnersAndAuxiliary(
  deps: ServiceDeps,
  studioOrigin: string,
  processPort: ProcessPort,
  eventBus: EventBusPort,
  fs: FileSystemPort,
  runnerScript: string,
  projectService: ProjectService,
  runnerHolder: { current?: RunnerService | undefined },
  resolveRunnerScript?: (entry: string) => string,
) {
  const runnerService = createProjectRunner(
    deps,
    runnerScript,
    projectService,
    processPort,
    eventBus,
    studioOrigin,
    resolveRunnerScript,
  );
  runnerHolder.current = runnerService;
  const auxiliary = createAuxiliaryServices(deps, processPort, fs, projectService);
  return { runnerService, auxiliary };
}

function initProjectServices(
  deps: ServiceDeps,
  eventBus: EventBusPort,
  watcher: WatcherPort,
  fs: FileSystemPort,
  runnerHolder: { current?: RunnerService | undefined },
) {
  const projectHolder: { current?: ProjectService | undefined } = {};
  const { historyService, jobService, watch } = createFileServices(
    deps,
    eventBus,
    watcher,
    projectHolder,
  );
  const mirrorService = createMirrorService({ fs, cacheDir: deps.cacheDir, logger: deps.logger });
  const projectService = createProjectWithWatch(
    deps,
    historyService,
    jobService,
    mirrorService,
    watch,
    runnerHolder,
    projectHolder,
  );
  return { historyService, jobService, mirrorService, projectService };
}

function createAgentSetup(
  processPort: ProcessPort,
  jobService: JobService,
  auxiliary: ReturnType<typeof createAuxiliaryServices>,
) {
  return createAgentSetupService({
    process: processPort,
    jobs: jobService,
    agents: auxiliary.agentService,
    homeDir: auxiliary.setupEnv.homeDir,
    plans: auxiliary.plans,
    terminal: (cmd) => terminalCommand(auxiliary.setupEnv, cmd),
  });
}

export function createServices(
  deps: ServiceDeps,
  studioOrigin: string,
  processPort: ProcessPort,
  eventBus: EventBusPort,
  fs: FileSystemPort,
  watcher: WatcherPort,
  runnerScript: string,
  resolveRunnerScript?: (entry: string) => string,
): CoreServices {
  const runnerHolder: { current?: RunnerService | undefined } = {};
  const projectServices = initProjectServices(deps, eventBus, watcher, fs, runnerHolder);

  const { runnerService, auxiliary } = createRunnersAndAuxiliary(
    deps,
    studioOrigin,
    processPort,
    eventBus,
    fs,
    runnerScript,
    projectServices.projectService,
    runnerHolder,
    resolveRunnerScript,
  );

  const agentTurns = createAgentTurnServices(
    deps,
    fs,
    processPort,
    projectServices.jobService,
    projectServices.mirrorService,
    projectServices.projectService,
    eventBus,
    auxiliary,
  );

  const agentSetupService = createAgentSetup(processPort, projectServices.jobService, auxiliary);
  attachAutoRestart(eventBus, projectServices.projectService, runnerHolder);

  return {
    ...projectServices,
    runnerService,
    ...agentTurns,
    usageCounter: auxiliary.usageCounter,
    sourceEditorService: auxiliary.sourceEditorService,
    agentService: auxiliary.agentService,
    agentSetupService,
    turnSnapshotStore: auxiliary.turnSnapshotStore,
  };
}
