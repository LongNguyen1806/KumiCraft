// Multi-file commit of the JSX editor (R-SE-29): the writing itself is the kernel's FileWriter; this
// keeps the parsed AST of each written file for the next edit.
import { ok, type Result } from '@kumicraft/shared';

import type { WrittenFile } from '../../../kernel/editing.ts';
import { commitFileChanges, withFileLocks } from '../../../kernel/file-writer.ts';
import type { AstNode } from '../../../lib/ast-helpers.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';
import { cacheAst } from './source-editor-lookup.ts';

export { withFileLocks };

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

export async function commitPreparedFiles(
  fs: FileSystemPort,
  projectRoot: string,
  prepared: readonly PreparedFileWrite[],
): Promise<Result<readonly WrittenFile[]>> {
  const changes = prepared.map((p) => ({
    path: p.rel,
    before: p.rawBefore,
    after: p.finalContent,
  }));
  const committed = await commitFileChanges({ fs }, projectRoot, changes);
  if (!committed.ok) return committed;
  const written: WrittenFile[] = [];
  for (const item of prepared) {
    const file = committed.value.find((f) => f.path === item.rel);
    const afterHash = file?.afterHash ?? item.beforeHash;
    cacheAst(item.rel, item.modifiedCode, afterHash, item.nextAst);
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
