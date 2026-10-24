// Reacts to files of the open project changing on disk (R-HI-05, V-70, S-84).
import { WORKSPACE_FILE } from '@kumicraft/shared';

import { computeSha256, type HistoryService } from '../history/history-service.ts';
import type { EventBusPort } from '../ports/event-bus-port.ts';
import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { WatcherPort, WatchHandle } from '../ports/watcher-port.ts';

/** V-70: at most this many paths in one `project.filesChanged`. */
export const MAX_CHANGED_FILES = 100;

export type ProjectWatchDeps = {
  readonly watcher: WatcherPort;
  readonly fs: FileSystemPort;
  readonly history: Pick<HistoryService, 'handleExternalChange'>;
  readonly logger: LoggerPort;
  readonly eventBus?: EventBusPort | undefined;
  /** `.kumicraft/workspace.json` changed on disk. */
  readonly onWorkspaceFileChanged: () => Promise<void>;
};

export type ProjectWatch = {
  /** Watches root; a watch of another root stops first. */
  start(root: string): void;
  stop(): Promise<void>;
};

/** Hash of the file now, '' when it is gone or cannot be read. */
async function currentHash(fs: FileSystemPort, root: string, file: string): Promise<string> {
  const read = await fs.readText(root, file);
  return read.ok ? computeSha256(read.value) : '';
}

/** Files edited outside KumiCraft (R-HI-05); KumiCraft's own data under .kumicraft/ is not. */
async function externalChanges(
  deps: ProjectWatchDeps,
  root: string,
  files: readonly string[],
): Promise<string[]> {
  const changed: string[] = [];
  for (const file of files) {
    if (file.startsWith('.kumicraft/')) continue;
    const hash = await currentHash(deps.fs, root, file);
    if (deps.history.handleExternalChange(file, hash)) changed.push(file);
  }
  return changed;
}

async function handleBatch(
  deps: ProjectWatchDeps,
  root: string,
  files: readonly string[],
): Promise<void> {
  if (files.includes(WORKSPACE_FILE)) await deps.onWorkspaceFileChanged();
  const changed = await externalChanges(deps, root, files);
  if (changed.length === 0) return;
  const truncated = changed.length > MAX_CHANGED_FILES;
  deps.eventBus?.publish('project.filesChanged', {
    files: changed.slice(0, MAX_CHANGED_FILES),
    ...(truncated ? { truncated: true } : {}),
  });
}

export function createProjectWatch(deps: ProjectWatchDeps): ProjectWatch {
  let handle: WatchHandle | undefined;
  // Batches run one after another, so the order of events matches the order on disk.
  const pending: { readonly root: string; readonly files: readonly string[] }[] = [];
  let draining = false;

  const drain = async () => {
    if (draining) return;
    draining = true;
    try {
      for (let batch = pending.shift(); batch !== undefined; batch = pending.shift()) {
        try {
          await handleBatch(deps, batch.root, batch.files);
        } catch (cause) {
          deps.logger.warn({ err: cause }, 'handling changed project files failed');
        }
      }
    } finally {
      draining = false;
    }
  };

  const stop = async () => {
    const current = handle;
    handle = undefined;
    await current?.close();
  };

  return {
    start(root: string): void {
      void stop();
      handle = deps.watcher.watch(root, (files) => {
        pending.push({ root, files });
        void drain();
      });
    },
    stop,
  };
}
