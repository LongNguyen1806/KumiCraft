// Pug draft operations (views/_drafts/*.pug): list, create, rename, duplicate, delete, and
// promote to component (page promotion delegates to expressPugStack.pages via ProjectDraftOps).
import { posix } from 'node:path';

import {
  type CreateDraft,
  type DraftFile,
  type DraftInfo,
  type DraftsInfo,
  err,
  ok,
  primarySystem,
  type PromoteDraft,
  type RenameDraft,
  type Result,
  type StructureResult,
  type StylingReport,
  toComponentName,
} from '@kumicraft/shared';

import type { PageEditDeps } from '../../../kernel/features.ts';
import { commitFileChanges, type FileChange } from '../../../kernel/file-writer.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';

const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage']);

export function resolvePugDraftsDir(deps: PageEditDeps): string {
  const configured = deps.designDirs.drafts.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
  return configured === '' || configured === 'src/drafts' ? 'views/_drafts' : configured;
}

function toKebabName(name: string): string {
  const kebab = name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return kebab || 'draft';
}

function normalizePugFileName(raw: string | undefined, name: string): string {
  if (raw === undefined || raw.trim() === '') return `${toKebabName(name)}.pug`;
  const stripped = raw.trim().replace(/\.(?:tsx|jsx|ts|js|pug)$/i, '');
  return `${stripped || 'draft'}.pug`;
}

function draftRootLine(free: boolean, styling: StylingReport | undefined): string {
  const system = primarySystem(styling);
  if (system === 'tailwind4' || system === 'tailwind3' || styling === undefined) {
    return free
      ? 'div.relative.min-h-screen.w-full.bg-white(data-rc-free)'
      : 'div.min-h-screen.bg-white.p-8';
  }
  if (system === 'bootstrap5') {
    return free
      ? 'div.position-relative.min-vh-100.w-100.bg-white(data-rc-free)'
      : 'div.min-vh-100.bg-white.p-4';
  }
  return free
    ? "div(data-rc-free, style='position: relative; min-height: 100vh; width: 100%; background: #fff')"
    : "div(style='min-height: 100vh; background: #fff; padding: 32px')";
}

async function isDraftIgnored(
  fs: FileSystemPort,
  root: string,
  draftsDir: string,
): Promise<boolean> {
  const read = await fs.readText(root, '.gitignore', { maxBytes: 128 * 1024 });
  if (!read.ok) return false;
  const base = posix.basename(draftsDir);
  return read.value.split(/\r?\n/).some((line) => {
    const trimmed = line.trim().replace(/\/+$/, '');
    return trimmed === draftsDir || trimmed === base || trimmed === `/${draftsDir}`;
  });
}

async function collectIncludedPugRefs(
  fs: FileSystemPort,
  root: string,
  dir: string,
  out: Set<string>,
): Promise<void> {
  const entries = await fs.readDir(root, dir === '' ? '.' : dir);
  if (!entries.ok) return;
  for (const entry of entries.value) {
    if (entry.name.startsWith('.') || SKIPPED_DIRS.has(entry.name)) continue;
    const rel = dir === '' ? entry.name : `${dir}/${entry.name}`;
    if (entry.kind === 'directory') {
      await collectIncludedPugRefs(fs, root, rel, out);
    } else if (entry.name.endsWith('.pug')) {
      const read = await fs.readText(root, rel, { maxBytes: 512 * 1024 });
      if (!read.ok) continue;
      for (const m of read.value.matchAll(/^\s*include\s+([^\s(]+)/gm)) {
        const raw = m[1]?.replaceAll('\\', '/').replace(/\.pug$/i, '');
        if (raw === undefined) continue;
        out.add(`${posix.normalize(posix.join(posix.dirname(rel), raw))}.pug`);
      }
    }
  }
}

function validateDraftLocation(file: string, draftsDir: string): Result<string> {
  const norm = file.replaceAll('\\', '/');
  if (!norm.endsWith('.pug') || norm.includes('..') || !norm.startsWith(`${draftsDir}/`)) {
    return err({ code: 'E016', params: { reason: 'invalidPath' } });
  }
  return ok(norm);
}

async function nextAvailableDraft(
  fs: FileSystemPort,
  root: string,
  draftsDir: string,
  base: string,
): Promise<string> {
  let candidate = posix.join(draftsDir, `${base}.pug`);
  let counter = 2;
  while (await fs.exists(root, candidate)) {
    candidate = posix.join(draftsDir, `${base}-${String(counter)}.pug`);
    counter += 1;
  }
  return candidate;
}

export async function listPugDrafts(deps: PageEditDeps): Promise<Result<DraftsInfo>> {
  const draftsDir = resolvePugDraftsDir(deps);
  const entries = await deps.fs.readDir(deps.projectRoot, draftsDir);
  const drafts: DraftInfo[] = [];
  if (entries.ok) {
    const included = new Set<string>();
    await collectIncludedPugRefs(deps.fs, deps.projectRoot, 'views', included);
    for (const entry of entries.value) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.pug')) continue;
      const file = `${draftsDir}/${entry.name}`;
      const read = await deps.fs.readText(deps.projectRoot, file, { maxBytes: 512 * 1024 });
      if (!read.ok) continue;
      const base = posix.basename(entry.name, '.pug');
      drafts.push({
        name: toComponentName(base) || base,
        file,
        free: /\bdata-rc-free\b/.test(read.value),
        inUse: included.has(file),
      });
    }
  }
  drafts.sort((a, b) => a.name.localeCompare(b.name));
  const ignored = await isDraftIgnored(deps.fs, deps.projectRoot, draftsDir);
  return ok({ drafts, dir: draftsDir, ignored });
}

export async function createPugDraft(
  deps: PageEditDeps,
  input: CreateDraft,
): Promise<Result<StructureResult>> {
  const draftsDir = resolvePugDraftsDir(deps);
  const base = input.name && input.name.trim() !== '' ? toKebabName(input.name) : 'draft';
  const fileRel = await nextAvailableDraft(deps.fs, deps.projectRoot, draftsDir, base);
  const content = `${draftRootLine(input.free, deps.styling)}\n`;
  const displayName = toComponentName(posix.basename(fileRel, '.pug')) || base;
  const label = { key: 'history:draftCreate', params: { name: displayName } };
  const written = await commitFileChanges(
    { fs: deps.fs, history: deps.history },
    deps.projectRoot,
    [{ path: fileRel, before: undefined, after: content }],
    { label },
  );
  if (!written.ok) return written;
  return ok({ changed: true, files: [fileRel], locs: [], draftFile: fileRel });
}

export async function renamePugDraft(
  deps: PageEditDeps,
  input: RenameDraft,
): Promise<Result<StructureResult>> {
  const draftsDir = resolvePugDraftsDir(deps);
  const valid = validateDraftLocation(input.file, draftsDir);
  if (!valid.ok) return valid;
  const read = await deps.fs.readText(deps.projectRoot, valid.value, { keepBom: true });
  if (!read.ok) return read;
  const nextFile = posix.join(draftsDir, `${toKebabName(input.newName)}.pug`);
  if (nextFile !== valid.value && (await deps.fs.exists(deps.projectRoot, nextFile))) {
    return err({ code: 'E016', params: { reason: 'fileExists' } });
  }
  if (nextFile === valid.value) {
    return ok({ changed: false, files: [], locs: [], draftFile: valid.value });
  }
  const label = { key: 'history:draftRename', params: { name: input.newName } };
  const written = await commitFileChanges(
    { fs: deps.fs, history: deps.history },
    deps.projectRoot,
    [
      { path: valid.value, before: read.value, after: undefined },
      { path: nextFile, before: undefined, after: read.value },
    ],
    { label },
  );
  if (!written.ok) return written;
  return ok({ changed: true, files: [valid.value, nextFile], locs: [], draftFile: nextFile });
}

export async function duplicatePugDraft(
  deps: PageEditDeps,
  input: DraftFile,
): Promise<Result<StructureResult>> {
  const draftsDir = resolvePugDraftsDir(deps);
  const valid = validateDraftLocation(input.file, draftsDir);
  if (!valid.ok) return valid;
  const read = await deps.fs.readText(deps.projectRoot, valid.value, { keepBom: true });
  if (!read.ok) return read;
  const base = `${posix.basename(valid.value, '.pug')}-copy`;
  const copyFile = await nextAvailableDraft(deps.fs, deps.projectRoot, draftsDir, base);
  const label = {
    key: 'history:draftDuplicate',
    params: { name: posix.basename(copyFile, '.pug') },
  };
  const written = await commitFileChanges(
    { fs: deps.fs, history: deps.history },
    deps.projectRoot,
    [{ path: copyFile, before: undefined, after: read.value }],
    { label },
  );
  if (!written.ok) return written;
  return ok({ changed: true, files: [copyFile], locs: [], draftFile: copyFile });
}

export async function deletePugDraft(
  deps: PageEditDeps,
  input: DraftFile,
): Promise<Result<StructureResult>> {
  const draftsDir = resolvePugDraftsDir(deps);
  const valid = validateDraftLocation(input.file, draftsDir);
  if (!valid.ok) return valid;
  const read = await deps.fs.readText(deps.projectRoot, valid.value, { keepBom: true });
  if (!read.ok) return read;
  const label = {
    key: 'history:draftDelete',
    params: { name: posix.basename(valid.value, '.pug') },
  };
  const written = await commitFileChanges(
    { fs: deps.fs, history: deps.history },
    deps.projectRoot,
    [{ path: valid.value, before: read.value, after: undefined }],
    { label },
  );
  if (!written.ok) return written;
  return ok({ changed: true, files: [valid.value], locs: [] });
}

export async function promotePugDraft(
  deps: PageEditDeps,
  input: PromoteDraft,
): Promise<Result<StructureResult>> {
  if (input.as !== 'component') {
    return err({ code: 'E023', params: { reason: 'viewOnly' } });
  }
  const draftsDir = resolvePugDraftsDir(deps);
  const valid = validateDraftLocation(input.file, draftsDir);
  if (!valid.ok) return valid;
  const read = await deps.fs.readText(deps.projectRoot, valid.value, { keepBom: true });
  if (!read.ok) return read;
  const dir = (input.dir ?? 'views/components').replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
  const targetFile = posix.join(dir, normalizePugFileName(input.fileName, input.name));
  if (await deps.fs.exists(deps.projectRoot, targetFile)) {
    return err({ code: 'E016', params: { reason: 'fileExists' } });
  }
  const changes: FileChange[] = [
    { path: targetFile, before: undefined, after: read.value },
    ...(input.keepDraft ? [] : [{ path: valid.value, before: read.value, after: undefined }]),
  ];
  const label = { key: 'history:draftPromote', params: { name: input.name } };
  const written = await commitFileChanges(
    { fs: deps.fs, history: deps.history },
    deps.projectRoot,
    changes,
    {
      label,
    },
  );
  if (!written.ok) return written;
  return ok({ changed: true, files: changes.map((c) => c.path), locs: [] });
}
