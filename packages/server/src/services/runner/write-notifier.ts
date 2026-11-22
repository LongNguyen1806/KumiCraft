// Tells the project's dev server about the files KumiCraft wrote (K9.5). Vite's file watcher can
// miss the second of two writes of one file a few milliseconds apart (Undo twice on Windows): it
// then keeps serving the older content and the Canvas shows it while the file holds the newer.
// After writes settle, the runner asks Vite to read those files again.
import { resolve } from 'node:path';

import type { FileSystemPort } from '../../ports/file-system-port.ts';

/** Quiet time after the last write before Vite is told; longer than its watcher's throttle. */
export const WRITE_NOTIFY_DELAY_MS = 200;

/**
 * Collects written files and, once no write came for `delayMs`, hands over those written more
 * than once in that burst: the case a watcher can miss. A single write Vite sees by itself, and
 * telling it again would cause a second update right while the user goes on (found by E2E).
 */
export function createWriteNotifier(
  send: (files: readonly string[]) => void,
  delayMs = WRITE_NOTIFY_DELAY_MS,
): { readonly written: (absPath: string) => void; readonly stop: () => void } {
  const counts = new Map<string, number>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    written(absPath) {
      counts.set(absPath, (counts.get(absPath) ?? 0) + 1);
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        const again = [...counts].filter(([, n]) => n > 1).map(([file]) => file);
        counts.clear();
        if (again.length > 0) send(again);
      }, delayMs);
    },
    stop() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      counts.clear();
    },
  };
}

/** `fs` whose successful atomic writes are reported with their absolute path. */
export function reportWrites(
  fs: FileSystemPort,
  written: (absPath: string) => void,
): FileSystemPort {
  return {
    ...fs,
    async writeTextAtomic(root, path, content, options) {
      const res = await fs.writeTextAtomic(root, path, content, options);
      if (res.ok) written(resolve(root, path));
      return res;
    },
    async writeBytesAtomic(root, path, bytes, options) {
      const res = await fs.writeBytesAtomic(root, path, bytes, options);
      if (res.ok) written(resolve(root, path));
      return res;
    },
  };
}

/**
 * The file system the server uses, its writes passed to the dev server once `connect` names
 * where to send them (the runner is made after the file system).
 */
export function writeReportingFileSystem(fs: FileSystemPort): {
  readonly fs: FileSystemPort;
  readonly connect: (send: (files: readonly string[]) => void) => void;
} {
  let written: (absPath: string) => void = () => undefined;
  return {
    fs: reportWrites(fs, (absPath) => {
      written(absPath);
    }),
    connect(send) {
      written = createWriteNotifier(send).written;
    },
  };
}
