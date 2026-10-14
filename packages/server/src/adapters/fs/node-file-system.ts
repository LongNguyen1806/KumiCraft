// FileSystemPort on node:fs (ADR-BE-18, SPEC-05 section 7.2). Every path is checked (S-20, S-21),
// resolved to its real path inside the real root (S-22, S-23), and never written through a symlink
// or junction (S-24). Atomic writes retry while Windows holds the file (VG-01).
import {
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import writeFileAtomic from 'write-file-atomic';

import type {
  DirectoryEntry,
  FileSystemPort,
  ReadOptions,
} from '../../core/ports/file-system-port.ts';
import { checkPathSyntax, isInside } from '../../core/shared/paths.ts';
import { type AppError, err, ok, type Result } from '../../core/shared/result.ts';
import type { Platform } from '../../core/shared/session.ts';

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024; // S-29
const RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);
const MAX_ATTEMPTS = 10;
const BOM = 0xfeff;

const errorCode = (error: unknown): string | undefined =>
  error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;

/** Maps an operating-system error to an AppError (SPEC-03 section 10). */
function toAppError(error: unknown, path: string, operation: string): AppError {
  const code = errorCode(error);
  if (code === 'ENOENT')
    return { code: 'E015', params: { resource: 'file', id: path }, cause: error };
  if (code === 'EACCES' || code === 'EPERM') {
    return { code: 'E011', params: { path, operation }, cause: error };
  }
  return { code: 'E003', params: { file: path }, cause: error };
}

/** Real path of the longest existing prefix of `target`, with the missing tail appended (S-22). */
async function realpathOfExisting(target: string): Promise<string> {
  const tail: string[] = [];
  let existing = target;
  for (;;) {
    try {
      return join(await realpath(existing), ...tail.reverse());
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
      const parent = dirname(existing);
      if (parent === existing) return target;
      tail.push(basename(existing));
      existing = parent;
    }
  }
}

async function isSymlink(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isSymbolicLink();
  } catch {
    return false; // missing: nothing to follow
  }
}

async function resolveSafe(
  platform: Platform,
  root: string,
  path: string,
): Promise<Result<string>> {
  const syntax = checkPathSyntax(path, platform);
  if (syntax !== undefined) return err(syntax);
  try {
    const realRoot = await realpath(root);
    const real = await realpathOfExisting(resolve(realRoot, path));
    if (!isInside(realRoot, real, platform)) {
      return err({ code: 'E012', params: { path, reason: 'outsideRoot' } });
    }
    return ok(real);
  } catch (error) {
    return err(toAppError(error, path, 'resolve'));
  }
}

/** Resolves and refuses to write through a symlink or junction (S-24). */
async function resolveForWrite(
  platform: Platform,
  root: string,
  path: string,
): Promise<Result<string>> {
  const resolved = await resolveSafe(platform, root, path);
  if (!resolved.ok) return resolved;
  if (await isSymlink(join(root, path))) {
    return err({ code: 'E012', params: { path, reason: 'symlink' } });
  }
  return resolved;
}

async function withRetry(
  path: string,
  operation: string,
  action: () => Promise<void>,
): Promise<Result<void>> {
  for (let attempt = 1; ; attempt++) {
    try {
      await action();
      return ok(undefined);
    } catch (error) {
      if (!RETRY_CODES.has(errorCode(error) ?? '') || attempt === MAX_ATTEMPTS) {
        return err(toAppError(error, path, operation));
      }
      await sleep(Math.min(10 * 2 ** attempt, 200));
    }
  }
}

async function readText(platform: Platform, root: string, path: string, options: ReadOptions = {}) {
  const resolved = await resolveSafe(platform, root, path);
  if (!resolved.ok) return resolved;
  try {
    const { size } = await stat(resolved.value);
    if (size > (options.maxBytes ?? DEFAULT_MAX_BYTES)) {
      return err({ code: 'E003', params: { file: path, reason: 'tooLarge' } });
    }
    const text = await readFile(resolved.value, 'utf8');
    return ok(text.charCodeAt(0) === BOM ? text.slice(1) : text);
  } catch (error) {
    return err(toAppError(error, path, 'read'));
  }
}

async function createExclusive(platform: Platform, root: string, path: string, content: string) {
  const resolved = await resolveForWrite(platform, root, path);
  if (!resolved.ok) return resolved;
  try {
    await mkdir(dirname(resolved.value), { recursive: true });
    await writeFile(resolved.value, content, { encoding: 'utf8', flag: 'wx' });
    return ok('created' as const);
  } catch (error) {
    return errorCode(error) === 'EEXIST'
      ? ok('exists' as const)
      : err(toAppError(error, path, 'create'));
  }
}

async function readDir(
  platform: Platform,
  root: string,
  path: string,
): Promise<Result<readonly DirectoryEntry[]>> {
  const resolved = await resolveSafe(platform, root, path);
  if (!resolved.ok) return resolved;
  try {
    const entries = await readdir(resolved.value, { withFileTypes: true });
    // S-25: symlinks are neither listed as files nor followed.
    return ok(
      entries
        .filter((entry) => entry.isFile() || entry.isDirectory())
        .map((entry): DirectoryEntry => ({
          name: entry.name,
          kind: entry.isDirectory() ? 'directory' : 'file',
        })),
    );
  } catch (error) {
    return errorCode(error) === 'ENOENT' ? ok([]) : err(toAppError(error, path, 'list'));
  }
}

async function exists(platform: Platform, root: string, path: string): Promise<boolean> {
  const resolved = await resolveSafe(platform, root, path);
  if (!resolved.ok) return false;
  try {
    await lstat(resolved.value);
    return true;
  } catch {
    return false;
  }
}

/** Two paths resolved for a copy or a move; the target is checked for symlinks. */
async function resolvePair(
  platform: Platform,
  root: string,
  from: string,
  to: string,
  isMove: boolean,
) {
  const source = isMove
    ? await resolveForWrite(platform, root, from)
    : await resolveSafe(platform, root, from);
  if (!source.ok) return source;
  const target = await resolveForWrite(platform, root, to);
  return target.ok ? ok({ source: source.value, target: target.value }) : target;
}

export function createNodeFileSystem(platform: Platform): FileSystemPort {
  return {
    readText: (root, path, options) => readText(platform, root, path, options),
    async writeTextAtomic(root, path, content, options = {}) {
      const resolved = await resolveForWrite(platform, root, path);
      if (!resolved.ok) return resolved;
      return withRetry(path, 'write', async () => {
        await mkdir(dirname(resolved.value), { recursive: true });
        await writeFileAtomic(resolved.value, content, {
          encoding: 'utf8',
          ...(options.mode === undefined ? {} : { mode: options.mode }),
        });
      });
    },
    createExclusive: (root, path, content) => createExclusive(platform, root, path, content),
    readDir: (root, path) => readDir(platform, root, path),
    exists: (root, path) => exists(platform, root, path),
    async remove(root, path) {
      const resolved = await resolveForWrite(platform, root, path);
      if (!resolved.ok) return resolved;
      return withRetry(path, 'remove', () => rm(resolved.value, { recursive: true, force: true }));
    },
    async copy(root, from, to) {
      const pair = await resolvePair(platform, root, from, to, false);
      if (!pair.ok) return pair;
      return withRetry(to, 'copy', async () => {
        await mkdir(dirname(pair.value.target), { recursive: true });
        await copyFile(pair.value.source, pair.value.target);
      });
    },
    async rename(root, from, to) {
      const pair = await resolvePair(platform, root, from, to, true);
      if (!pair.ok) return pair;
      return withRetry(to, 'rename', async () => {
        await mkdir(dirname(pair.value.target), { recursive: true });
        await rename(pair.value.source, pair.value.target);
      });
    },
  };
}
