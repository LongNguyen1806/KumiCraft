// Per-file sequential task queue (R-SE-13).
const fileQueues = new Map<string, Promise<void>>();

/**
 * Executes a task sequentially per file path to prevent concurrent write race conditions.
 */
export async function queueFileTask<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const previous = fileQueues.get(filePath) ?? Promise.resolve();

  let releaseLock: () => void = () => undefined;
  const currentLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  fileQueues.set(filePath, currentLock);

  try {
    await previous;
  } catch {
    // Ignore error from prior task in queue so subsequent tasks still execute
  }

  try {
    return await task();
  } finally {
    releaseLock();
    if (fileQueues.get(filePath) === currentLock) {
      fileQueues.delete(filePath);
    }
  }
}

/**
 * Queue key of a project file. The Source Editor and the history share it, so an Undo never writes a
 * file while an edit of the same file is between its read and its write (R-SE-13, R-HI-06).
 */
export const fileQueueKey = (projectRoot: string, relPath: string): string =>
  `${projectRoot}:${relPath}`;
