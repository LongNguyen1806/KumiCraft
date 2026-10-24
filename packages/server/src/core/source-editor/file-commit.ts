// Multi-file atomic commit and locking for Source Editor (R-SE-29).
import type { Result } from '@kumicraft/shared';
import { ok } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { AstNode } from './ast-helpers.ts';
import { fileQueueKey, queueFileTask } from './file-queue.ts';
import { cacheAst, computeSha256 } from './source-editor-lookup.ts';
import type { WrittenFile } from './source-editor-service.ts';

export type PreparedFileWrite = {
  readonly rel: string;
  readonly rawBefore: string;
  readonly beforeHash: string;
  readonly modifiedCode: string;
  readonly finalContent: string;
  readonly nextAst: AstNode;
  readonly locs: readonly string[];
  readonly warnings: readonly string[];
};

export async function withFileLocks<T>(
  projectRoot: string,
  sortedFiles: readonly string[],
  task: () => Promise<T>,
  index = 0,
): Promise<T> {
  const file = sortedFiles[index];
  if (file === undefined) return task();
  return queueFileTask(fileQueueKey(projectRoot, file), () =>
    withFileLocks(projectRoot, sortedFiles, task, index + 1),
  );
}

export async function commitPreparedFiles(
  fs: FileSystemPort,
  projectRoot: string,
  prepared: readonly PreparedFileWrite[],
): Promise<Result<readonly WrittenFile[]>> {
  const written: WrittenFile[] = [];
  const committed: PreparedFileWrite[] = [];

  for (const item of prepared) {
    const writeRes = await fs.writeTextAtomic(projectRoot, item.rel, item.finalContent);
    if (!writeRes.ok) {
      for (const prev of committed) {
        await fs.writeTextAtomic(projectRoot, prev.rel, prev.rawBefore);
      }
      return writeRes;
    }
    const afterHash = computeSha256(item.finalContent);
    cacheAst(item.rel, item.modifiedCode, afterHash, item.nextAst);
    committed.push(item);
    written.push({
      path: item.rel,
      before: item.rawBefore,
      after: item.finalContent,
      beforeHash: item.beforeHash,
      afterHash,
    });
  }

  return ok(written);
}
