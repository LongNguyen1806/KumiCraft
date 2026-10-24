// Draft operations implementing M-DR (SPEC-04 section 18D, R-DR-10 to R-DR-16, spec-log #25).
import * as path from 'node:path';

import {
  type CreateDraft,
  DEFAULT_DESIGN_DIRS,
  type DraftFile,
  type DraftInfo,
  type DraftsInfo,
  err,
  ok,
  pageNames,
  type RenameDraft,
  type Result,
  type StructureResult,
} from '@kumicraft/shared';

import { computeSha256 } from '../history/history-service.ts';
import {
  extractExportedComponentInfo,
  isDraftIgnored,
  isDraftInUse,
  renameComponentInCode,
  validateDraftFileLocation,
} from './draft-helpers.ts';
import { type PageEditDeps, withFileLocks } from './page-common.ts';

export function getDraftsDir(deps: PageEditDeps): string {
  return deps.designDirs.drafts ?? DEFAULT_DESIGN_DIRS.drafts;
}

export async function listDrafts(deps: PageEditDeps): Promise<Result<DraftsInfo>> {
  const draftsDir = getDraftsDir(deps);
  const entriesRes = await deps.fs.readDir(deps.projectRoot, draftsDir);
  const drafts: DraftInfo[] = [];

  if (entriesRes.ok) {
    for (const entry of entriesRes.value) {
      if (entry.kind !== 'file' || !/\.(tsx|jsx)$/.test(entry.name)) continue;
      const fileRel = `${draftsDir}/${entry.name}`;
      const read = await deps.fs.readText(deps.projectRoot, fileRel);
      if (!read.ok) continue;

      const compInfo = extractExportedComponentInfo(read.value);
      const name = compInfo?.name ?? path.posix.basename(entry.name).replace(/\.(tsx|jsx)$/, '');
      const free = compInfo?.free ?? false;
      const inUse = await isDraftInUse(deps.fs, deps.projectRoot, deps.sourceDir, fileRel);

      drafts.push({ name, file: fileRel, free, inUse });
    }
  }

  drafts.sort((a, b) => a.name.localeCompare(b.name));
  const ignored = await isDraftIgnored(deps.fs, deps.projectRoot, draftsDir);
  return ok({ drafts, dir: draftsDir, ignored });
}

function buildDraftContent(componentName: string, free: boolean): string {
  if (free) {
    return [
      `export function ${componentName}() {`,
      '  return <div data-rc-free className="relative min-h-screen w-full bg-white"></div>;',
      '}\n',
    ].join('\n');
  }
  return [
    `export function ${componentName}() {`,
    '  return <div className="min-h-screen bg-white p-8"></div>;',
    '}\n',
  ].join('\n');
}

async function resolveNewDraftNames(
  deps: PageEditDeps,
  draftsDir: string,
  inputName?: string,
): Promise<{
  readonly draftName: string;
  readonly componentName: string;
  readonly fileRel: string;
}> {
  const ext = deps.language === 'ts' ? 'tsx' : 'jsx';
  if (inputName && inputName.trim().length > 0) {
    const names = pageNames(inputName.trim(), deps.language);
    return {
      draftName: inputName.trim(),
      componentName: names.component,
      fileRel: `${draftsDir}/${names.component}.${ext}`,
    };
  }

  let n = 1;
  while (n < 1000) {
    const draftName = `Bản nháp ${String(n)}`;
    const componentName = `BanNhap${String(n)}`;
    const fileRel = `${draftsDir}/${componentName}.${ext}`;
    if (!(await deps.fs.exists(deps.projectRoot, fileRel))) {
      return { draftName, componentName, fileRel };
    }
    n++;
  }
  return {
    draftName: 'Bản nháp',
    componentName: 'BanNhap',
    fileRel: `${draftsDir}/BanNhap.${ext}`,
  };
}

export async function createDraft(
  deps: PageEditDeps,
  input: CreateDraft,
): Promise<Result<StructureResult>> {
  const draftsDir = getDraftsDir(deps);
  const names = await resolveNewDraftNames(deps, draftsDir, input.name);

  if (await deps.fs.exists(deps.projectRoot, names.fileRel)) {
    return err({ code: 'E016', params: { file: names.fileRel, reason: 'fileExists' } });
  }

  const content = buildDraftContent(names.componentName, input.free);
  const hash = computeSha256(content);

  return withFileLocks(deps.projectRoot, [names.fileRel], async () => {
    const writeRes = await deps.fs.writeTextAtomic(deps.projectRoot, names.fileRel, content);
    if (!writeRes.ok) return writeRes;

    deps.history.recordInternalWrite(names.fileRel, hash);
    deps.history.push({
      label: { key: 'history:draftCreate', params: { name: names.draftName } },
      files: [{ path: names.fileRel, after: content, afterHash: hash }],
    });

    return ok({
      changed: true,
      files: [names.fileRel],
      locs: [],
      draftFile: names.fileRel,
    });
  });
}

async function validateRenameDraft(
  deps: PageEditDeps,
  draftsDir: string,
  input: RenameDraft,
): Promise<Result<{ component: string; newFileRel: string }>> {
  const locCheck = validateDraftFileLocation(input.file, draftsDir, deps);
  if (!locCheck.ok) return locCheck;

  if (!(await deps.fs.exists(deps.projectRoot, input.file))) {
    return err({ code: 'E017', params: { loc: input.file, reason: 'notFound' } });
  }

  if (await isDraftInUse(deps.fs, deps.projectRoot, deps.sourceDir, input.file)) {
    return err({ code: 'E016', params: { reason: 'draftInUse' } });
  }

  const names = pageNames(input.newName, deps.language);
  const ext = path.posix.extname(input.file);
  const newFileRel = `${draftsDir}/${names.component}${ext}`;

  if (newFileRel !== input.file && (await deps.fs.exists(deps.projectRoot, newFileRel))) {
    return err({ code: 'E016', params: { file: newFileRel, reason: 'fileExists' } });
  }

  return ok({ component: names.component, newFileRel });
}

export async function renameDraft(
  deps: PageEditDeps,
  input: RenameDraft,
): Promise<Result<StructureResult>> {
  const draftsDir = getDraftsDir(deps);
  const validRes = await validateRenameDraft(deps, draftsDir, input);
  if (!validRes.ok) return validRes;
  const { component, newFileRel } = validRes.value;

  const readOld = await deps.fs.readText(deps.projectRoot, input.file);
  if (!readOld.ok) return readOld;

  const renameRes = renameComponentInCode(readOld.value, component);
  if (!renameRes.ok) return renameRes;
  const newContent = renameRes.value;

  return withFileLocks(deps.projectRoot, [input.file, newFileRel], async () => {
    const writeRes = await deps.fs.writeTextAtomic(deps.projectRoot, newFileRel, newContent);
    if (!writeRes.ok) return writeRes;

    if (newFileRel !== input.file) {
      const removeRes = await deps.fs.remove(deps.projectRoot, input.file);
      if (!removeRes.ok) {
        await deps.fs.remove(deps.projectRoot, newFileRel);
        return removeRes;
      }
    }

    const oldHash = computeSha256(readOld.value);
    const newHash = computeSha256(newContent);
    deps.history.recordInternalWrite(newFileRel, newHash);

    deps.history.push({
      label: { key: 'history:draftRename', params: { name: input.newName } },
      files: [
        { path: input.file, before: readOld.value, beforeHash: oldHash },
        { path: newFileRel, after: newContent, afterHash: newHash },
      ],
    });

    return ok({
      changed: true,
      files: [input.file, newFileRel],
      locs: [],
      draftFile: newFileRel,
    });
  });
}

export async function duplicateDraft(
  deps: PageEditDeps,
  input: DraftFile,
): Promise<Result<StructureResult>> {
  const draftsDir = getDraftsDir(deps);
  const locCheck = validateDraftFileLocation(input.file, draftsDir, deps);
  if (!locCheck.ok) return locCheck;

  if (!(await deps.fs.exists(deps.projectRoot, input.file))) {
    return err({ code: 'E017', params: { loc: input.file, reason: 'notFound' } });
  }

  const readOld = await deps.fs.readText(deps.projectRoot, input.file);
  if (!readOld.ok) return readOld;

  const ext = path.posix.extname(input.file);
  const baseCompName =
    extractExportedComponentInfo(readOld.value)?.name ??
    path.posix.basename(input.file).replace(/\.(tsx|jsx)$/, '');

  let n = 2;
  let newCompName = `${baseCompName}${String(n)}`;
  let newFileRel = `${draftsDir}/${newCompName}${ext}`;
  while (await deps.fs.exists(deps.projectRoot, newFileRel)) {
    n++;
    newCompName = `${baseCompName}${String(n)}`;
    newFileRel = `${draftsDir}/${newCompName}${ext}`;
  }

  const renameRes = renameComponentInCode(readOld.value, newCompName);
  if (!renameRes.ok) return renameRes;
  const newContent = renameRes.value;
  const newHash = computeSha256(newContent);

  return withFileLocks(deps.projectRoot, [newFileRel], async () => {
    const writeRes = await deps.fs.writeTextAtomic(deps.projectRoot, newFileRel, newContent);
    if (!writeRes.ok) return writeRes;

    deps.history.recordInternalWrite(newFileRel, newHash);
    deps.history.push({
      label: { key: 'history:draftDuplicate', params: { name: newCompName } },
      files: [{ path: newFileRel, after: newContent, afterHash: newHash }],
    });

    return ok({
      changed: true,
      files: [newFileRel],
      locs: [],
      draftFile: newFileRel,
    });
  });
}

export async function deleteDraft(
  deps: PageEditDeps,
  input: DraftFile,
): Promise<Result<StructureResult>> {
  const draftsDir = getDraftsDir(deps);
  const locCheck = validateDraftFileLocation(input.file, draftsDir, deps);
  if (!locCheck.ok) return locCheck;

  if (!(await deps.fs.exists(deps.projectRoot, input.file))) {
    return err({ code: 'E017', params: { loc: input.file, reason: 'notFound' } });
  }

  if (await isDraftInUse(deps.fs, deps.projectRoot, deps.sourceDir, input.file)) {
    return err({ code: 'E016', params: { reason: 'draftInUse' } });
  }

  const readOld = await deps.fs.readText(deps.projectRoot, input.file);
  if (!readOld.ok) return readOld;
  const oldHash = computeSha256(readOld.value);

  return withFileLocks(deps.projectRoot, [input.file], async () => {
    const removeRes = await deps.fs.remove(deps.projectRoot, input.file);
    if (!removeRes.ok) return removeRes;

    deps.history.push({
      label: { key: 'history:draftDelete', params: { name: input.file } },
      files: [{ path: input.file, before: readOld.value, beforeHash: oldHash }],
    });

    return ok({
      changed: true,
      files: [input.file],
      locs: [],
    });
  });
}
