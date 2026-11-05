// Auto-restarts the runner when watched files change and adapter.restartOn matches (SPEC-04 M-RN, Phase 4 K4).
import type { EventBusPort } from '../ports/event-bus-port.ts';
import type { ProjectService } from '../project/project-service.ts';
import type { RunnerService } from './runner-service.ts';

export function attachAutoRestart(
  eventBus: EventBusPort | undefined,
  projectService: Pick<ProjectService, 'getAdapter'>,
  runnerHolder: { readonly current?: RunnerService | undefined },
): () => void {
  let timer: NodeJS.Timeout | undefined;
  if (eventBus === undefined || typeof eventBus.subscribe !== 'function') {
    return () => {};
  }
  return eventBus.subscribe((event) => {
    if (event.type !== 'project.filesChanged') return;
    const adapter = projectService.getAdapter();
    if (typeof adapter.restartOn !== 'function') return;
    const payload = event.payload as { files?: readonly unknown[] } | undefined;
    const files = payload?.files;
    const stringFiles = Array.isArray(files)
      ? files.filter((f): f is string => typeof f === 'string')
      : [];
    if (!stringFiles.some((f) => adapter.restartOn?.(f))) {
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
