// Folder watcher on chokidar (ADR-BE-20): skips node_modules, .git, dist and KumiCraft's own
// lock and cache, and hands the changed paths over in batches of 300 ms.
import { relative } from 'node:path';

import { watch } from 'chokidar';

import type { WatchHandle } from '../../ports/watcher-port.ts';

export const WATCH_BATCH_MS = 300;

// `obj` and `bin`: .NET build output, and the stamped copy of an ASP.NET project (03c section 2.4).
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'obj', 'bin']);
const IGNORED_PATHS = ['.kumicraft/lock', '.kumicraft/cache'];

/** Relative path with '/' separators, or undefined for the root itself. */
function toRelative(root: string, path: string): string | undefined {
  const rel = relative(root, path).replaceAll('\\', '/');
  return rel === '' ? undefined : rel;
}

export function isIgnoredPath(rel: string): boolean {
  if (rel.split('/').some((part) => IGNORED_DIRS.has(part))) return true;
  return IGNORED_PATHS.some((ignored) => rel === ignored || rel.startsWith(`${ignored}/`));
}

/** Resolves once chokidar has scanned the folder and reports changes. */
export type ChokidarWatchHandle = WatchHandle & { readonly ready: Promise<void> };

/** A WatcherPort whose handles also tell when watching has begun. */
export type ChokidarWatcher = {
  watch(root: string, onBatch: (files: readonly string[]) => void): ChokidarWatchHandle;
};

export function createChokidarWatcher(batchMs = WATCH_BATCH_MS): ChokidarWatcher {
  return {
    watch(root: string, onBatch: (files: readonly string[]) => void): ChokidarWatchHandle {
      const pending = new Set<string>();
      let timer: ReturnType<typeof setTimeout> | undefined;

      const flush = () => {
        timer = undefined;
        if (pending.size === 0) return;
        const files = [...pending];
        pending.clear();
        onBatch(files);
      };

      const watcher = watch(root, {
        ignoreInitial: true,
        ignored: (path: string) => {
          const rel = toRelative(root, path);
          return rel !== undefined && isIgnoredPath(rel);
        },
      });

      watcher.on('all', (event, path) => {
        if (event !== 'add' && event !== 'change' && event !== 'unlink') return;
        const rel = toRelative(root, path);
        if (rel === undefined) return;
        pending.add(rel);
        timer ??= setTimeout(flush, batchMs);
      });

      const ready = new Promise<void>((resolve) => {
        watcher.once('ready', () => {
          resolve();
        });
      });

      return {
        ready,
        close: async () => {
          if (timer !== undefined) clearTimeout(timer);
          timer = undefined;
          pending.clear();
          await watcher.close();
        },
      };
    },
  };
}
