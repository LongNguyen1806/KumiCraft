// Service assembly for the local server (SPEC-01 section 3.2).
import { createHistoryService, type HistoryService } from './core/history/history-service.ts';
import { createJobService, type JobService } from './core/jobs/job-service.ts';
import { createMirrorService } from './core/mirror/mirror-service.ts';
import type { MirrorService } from './core/mirror/mirror-types.ts';
import type { EventBusPort } from './core/ports/event-bus-port.ts';
import type { FileSystemPort } from './core/ports/file-system-port.ts';
import type { ProcessPort } from './core/ports/process-port.ts';
import type { WatcherPort } from './core/ports/watcher-port.ts';
import type { FrameworkAdapter } from './core/project/frameworks/types.ts';
import {
  createProjectService,
  type ProjectService,
  type ProjectServiceDeps,
} from './core/project/project-service.ts';
import { createProjectWatch, type ProjectWatch } from './core/project/project-watch.ts';
import { createRunnerService, type RunnerService } from './core/runner/runner-service.ts';
import { ok } from './core/shared/result.ts';
import { createUsageCounter, type UsageCounter } from './core/source-editor/component-usages.ts';
import {
  createSourceEditorService,
  type SourceEditorService,
} from './core/source-editor/source-editor-service.ts';

export type ServiceDeps = Omit<ProjectServiceDeps, 'runnerService'> & {
  readonly runnerScriptPath?: string | undefined;
  readonly cacheDir: string;
};

export type CoreServices = {
  projectService: ProjectService;
  runnerService: RunnerService;
  sourceEditorService: SourceEditorService;
  historyService: HistoryService;
  jobService: JobService;
  mirrorService: MirrorService;
  usageCounter: UsageCounter;
};

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
  deps: Pick<ProjectServiceDeps, 'system' | 'logger'>,
  runnerScript: string,
  adapter: FrameworkAdapter,
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
    adapter,
    runnerScriptPath: runnerScript,
  });
}

function createRunnerProxy(runnerHolder: { current?: RunnerService | undefined }) {
  const stopped = () => Promise.resolve(ok({ state: 'stopped' as const }));
  return {
    start: () => runnerHolder.current?.start() ?? stopped(),
    stop: () => runnerHolder.current?.stop() ?? stopped(),
  };
}

export function createServices(
  deps: ServiceDeps,
  studioOrigin: string,
  processPort: ProcessPort,
  eventBus: EventBusPort,
  fs: FileSystemPort,
  watcher: WatcherPort,
  runnerScript: string,
  adapter: FrameworkAdapter,
): CoreServices {
  const runnerHolder: { current?: RunnerService | undefined } = {};
  const projectHolder: { current?: ProjectService | undefined } = {};
  const { historyService, jobService, watch } = createFileServices(
    deps,
    eventBus,
    watcher,
    projectHolder,
  );
  const mirrorService = createMirrorService({ fs, cacheDir: deps.cacheDir, logger: deps.logger });
  const projectService = createProjectService({
    ...deps,
    watch,
    jobs: jobService,
    history: historyService,
    mirror: mirrorService,
    runnerService: createRunnerProxy(runnerHolder),
  });
  projectHolder.current = projectService;

  const runnerService = createProjectRunner(
    deps,
    runnerScript,
    adapter,
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
    mirrorService,
    usageCounter,
  };
}
