// File verification, atomic write, and rollback for HistoryService (SPEC-04, R-HI-04, R-HI-11).
import { createHash } from 'node:crypto';

import type { Result } from '@reactcraft/shared';
import { ok } from '@reactcraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { HistoryFileChange } from './history-service.ts';

/** SHA-256 of a file's text, as History records it (R-HI-04, R-HI-05). */
export function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/** SHA-256 of binary bytes, as History records it (R-HI-11). */
export function computeBytesSha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function hashOfCurrent(
  fs: FileSystemPort,
  root: string,
  f: HistoryFileChange,
): Promise<string | undefined> {
  if (f.encoding === 'base64') {
    const res = await fs.readBytes(root, f.path);
    return res.ok ? computeBytesSha256(res.value) : undefined;
  }
  const res = await fs.readText(root, f.path, { keepBom: true });
  return res.ok ? computeSha256(res.value) : undefined;
}

export async function verifyFilesMatchHash(
  fs: FileSystemPort,
  projectRoot: string,
  files: readonly HistoryFileChange[],
  targetHashKind: 'before' | 'after',
): Promise<{ readonly ok: true } | { readonly ok: false; readonly mismatchFile: string }> {
  for (const f of files) {
    const expected = targetHashKind === 'before' ? f.before : f.after;
    const expectedHash = targetHashKind === 'before' ? f.beforeHash : f.afterHash;
    if (expected !== undefined) {
      const current = await hashOfCurrent(fs, projectRoot, f);
      if (current === undefined || current !== expectedHash) {
        return { ok: false, mismatchFile: f.path };
      }
    } else if (await fs.exists(projectRoot, f.path)) {
      return { ok: false, mismatchFile: f.path };
    }
  }
  return { ok: true };
}

type AppliedAction = {
  readonly path: string;
  readonly rollbackContent?: string | undefined;
  readonly encoding?: 'base64' | undefined;
};

async function writeTarget(
  fs: FileSystemPort,
  root: string,
  path: string,
  target?: string,
  encoding?: 'base64',
): Promise<Result<void>> {
  if (target === undefined) return fs.remove(root, path);
  if (encoding === 'base64') {
    return fs.writeBytesAtomic(root, path, Buffer.from(target, 'base64'));
  }
  return fs.writeTextAtomic(root, path, target);
}

async function rollbackApplied(
  fs: FileSystemPort,
  projectRoot: string,
  applied: readonly AppliedAction[],
): Promise<void> {
  for (const item of [...applied].reverse()) {
    await writeTarget(fs, projectRoot, item.path, item.rollbackContent, item.encoding);
  }
}

export async function writeFilesAtomicWithRollback(
  fs: FileSystemPort,
  projectRoot: string,
  files: readonly HistoryFileChange[],
  targetContentKind: 'before' | 'after',
): Promise<Result<void>> {
  const applied: AppliedAction[] = [];

  for (const f of files) {
    const target = targetContentKind === 'before' ? f.before : f.after;
    const rollback = targetContentKind === 'before' ? f.after : f.before;

    const op = await writeTarget(fs, projectRoot, f.path, target, f.encoding);
    if (!op.ok) {
      await rollbackApplied(fs, projectRoot, applied);
      return op;
    }
    applied.push({ path: f.path, rollbackContent: rollback, encoding: f.encoding });
  }

  return ok(undefined);
}
