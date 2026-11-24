// Auto-restarts the runner when watched files change and runtime.restartOn matches (SPEC-04 M-RN, Phase 4 K4).
import type { EventBusPort } from '../../ports/event-bus-port.ts';
import type { ProjectService } from '../project/project-service.ts';
import type { RunnerService } from './runner-service.ts';

export function restartRunnerIfNeeded(
  files: readonly string[],
  projectService: Pick<ProjectService, 'getStack'> | undefined,
  runnerHolder: { readonly current?: RunnerService | undefined },
): void {
  if (projectService === undefined) return;
  const runtime = projectService.getStack().runtime;
  if (typeof runtime.restartOn !== 'function') return;
  if (!files.some((f) => runtime.restartOn?.(f))) return;
  if (runnerHolder.current?.getStatus().state !== 'ready') return;
  void runnerHolder.current.restart();
}

export function attachAutoRestart(
  eventBus: EventBusPort | undefined,
  projectService: Pick<ProjectService, 'getStack'>,
  runnerHolder: { readonly current?: RunnerService | undefined },
): () => void {
  let timer: NodeJS.Timeout | undefined;
  if (eventBus === undefined || typeof eventBus.subscribe !== 'function') {
    return () => {};
  }
  return eventBus.subscribe((event) => {
    if (event.type !== 'project.filesChanged') return;
    const runtime = projectService.getStack().runtime;
    if (typeof runtime.restartOn !== 'function') return;
    const payload = event.payload as { files?: readonly unknown[] } | undefined;
    const files = payload?.files;
    const stringFiles = Array.isArray(files)
      ? files.filter((f): f is string => typeof f === 'string')
      : [];
    if (!stringFiles.some((f) => runtime.restartOn?.(f))) {
      return;
    }
    if (runnerHolder.current?.getStatus().state !== 'ready') {
      return;
    }
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void runnerHolder.current?.restart();
    }, 500);
  });
}
