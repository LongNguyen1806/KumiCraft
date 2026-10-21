// Backend mirror service (ADR-BE-34, R-MR-01 to R-MR-04, S-118, S-120 to S-125).
import { join } from 'node:path';

import type { BackendInfo } from '@reactcraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { redactSecrets } from '../shared/redact-secrets.ts';
import {
  computeSha256,
  type ManifestFileItem,
  manifestRelPath,
  mirrorRelDir,
  readManifest,
  writeManifest,
} from './mirror-manifest.ts';
import { type CandidateFile, isBinaryFile, scanBackend } from './mirror-scan.ts';
import type {
  MirrorCheck,
  MirrorDeps,
  MirrorOptions,
  MirrorResult,
  MirrorService,
} from './mirror-types.ts';

type FileProcessOutcome =
  | { readonly kind: 'kept'; readonly item: ManifestFileItem }
  | { readonly kind: 'copied'; readonly item: ManifestFileItem }
  | { readonly kind: 'skipped' };

async function processCandidateFile(
  fs: FileSystemPort,
  cacheDir: string,
  backendRoot: string,
  projectId: string,
  backendId: string,
  candidate: CandidateFile,
  existing: ManifestFileItem | undefined,
): Promise<FileProcessOutcome> {
  const destPath = `${mirrorRelDir(projectId, backendId)}/${candidate.path}`;
  if (
    existing !== undefined &&
    existing.size === candidate.size &&
    existing.mtimeMs === candidate.mtimeMs &&
    (await fs.exists(cacheDir, destPath))
  ) {
    return { kind: 'kept', item: existing };
  }

  const readRes = await fs.readBytes(backendRoot, candidate.path);
  if (!readRes.ok || isBinaryFile(readRes.value)) {
    return { kind: 'skipped' };
  }

  const text = Buffer.from(readRes.value).toString('utf8');
  const redacted = redactSecrets(text);
  const writeRes = await fs.writeTextAtomic(cacheDir, destPath, redacted);
  if (!writeRes.ok) {
    return { kind: 'skipped' };
  }

  return {
    kind: 'copied',
    item: {
      path: candidate.path,
      size: candidate.size,
      mtimeMs: candidate.mtimeMs,
      sha256: computeSha256(redacted),
    },
  };
}

async function collectExistingMirrorFiles(
  fs: FileSystemPort,
  cacheDir: string,
  baseRel: string,
): Promise<string[]> {
  const results: string[] = [];
  const queue: string[] = [''];
  while (queue.length > 0) {
    const current = queue.shift() ?? '';
    const dirPath = current.length > 0 ? `${baseRel}/${current}` : baseRel;
    const listRes = await fs.readDir(cacheDir, dirPath);
    if (!listRes.ok) continue;
    for (const entry of listRes.value) {
      const rel = current.length > 0 ? `${current}/${entry.name}` : entry.name;
      if (entry.kind === 'directory') {
        queue.push(rel);
      } else {
        results.push(rel);
      }
    }
  }
  return results;
}

async function removeMirrorAndManifest(
  fs: FileSystemPort,
  cacheDir: string,
  projectId: string,
  backendId: string,
): Promise<void> {
  await fs.remove(cacheDir, mirrorRelDir(projectId, backendId));
  await fs.remove(cacheDir, manifestRelPath(projectId, backendId));
}

async function executeCheck(
  fs: FileSystemPort,
  cacheDir: string,
  projectId: string,
  backendId: string,
): Promise<MirrorCheck> {
  const manifestRel = manifestRelPath(projectId, backendId);
  if (!(await fs.exists(cacheDir, manifestRel))) {
    return 'absent';
  }
  const manifest = await readManifest(fs, cacheDir, manifestRel);
  const destDir = mirrorRelDir(projectId, backendId);
  for (const file of manifest.files) {
    // keepBom: the hash was taken of the text as written, BOM included.
    const readRes = await fs.readText(cacheDir, `${destDir}/${file.path}`, { keepBom: true });
    if (!readRes.ok || computeSha256(readRes.value) !== file.sha256) {
      await removeMirrorAndManifest(fs, cacheDir, projectId, backendId);
      return 'modified';
    }
  }
  const existingFiles = await collectExistingMirrorFiles(fs, cacheDir, destDir);
  const manifestPaths = new Set(manifest.files.map((f) => f.path));
  if (existingFiles.some((p) => !manifestPaths.has(p))) {
    await removeMirrorAndManifest(fs, cacheDir, projectId, backendId);
    return 'modified';
  }
  return 'intact';
}

async function syncCandidateFiles(
  deps: MirrorDeps,
  projectId: string,
  backend: BackendInfo,
  candidates: readonly CandidateFile[],
  existingMap: Map<string, ManifestFileItem>,
): Promise<{ readonly files: ManifestFileItem[]; readonly copied: number }> {
  const newFiles: ManifestFileItem[] = [];
  let copied = 0;
  for (const cf of candidates) {
    const outcome = await processCandidateFile(
      deps.fs,
      deps.cacheDir,
      backend.resolvedPath,
      projectId,
      backend.id,
      cf,
      existingMap.get(cf.path),
    );
    if (outcome.kind === 'kept') newFiles.push(outcome.item);
    if (outcome.kind === 'copied') {
      newFiles.push(outcome.item);
      copied++;
    }
  }
  return { files: newFiles, copied };
}

async function removeDeletedOldFiles(
  fs: FileSystemPort,
  cacheDir: string,
  projectId: string,
  backendId: string,
  oldFiles: readonly ManifestFileItem[],
  currentPaths: Set<string>,
): Promise<void> {
  for (const oldFile of oldFiles) {
    if (!currentPaths.has(oldFile.path)) {
      await fs.remove(cacheDir, `${mirrorRelDir(projectId, backendId)}/${oldFile.path}`);
    }
  }
}

async function syncScannedBackend(
  deps: MirrorDeps,
  projectId: string,
  backend: BackendInfo,
  scannedFiles: readonly CandidateFile[],
): Promise<{ filesCount: number; bytes: number; copied: number }> {
  const manifest = await readManifest(
    deps.fs,
    deps.cacheDir,
    manifestRelPath(projectId, backend.id),
  );
  const existingMap = new Map(manifest.files.map((f) => [f.path, f]));
  const { files: newFiles, copied } = await syncCandidateFiles(
    deps,
    projectId,
    backend,
    scannedFiles,
    existingMap,
  );
  await removeDeletedOldFiles(
    deps.fs,
    deps.cacheDir,
    projectId,
    backend.id,
    manifest.files,
    new Set(newFiles.map((f) => f.path)),
  );
  await writeManifest(deps.fs, deps.cacheDir, manifestRelPath(projectId, backend.id), {
    version: 1,
    files: newFiles,
  });
  return {
    filesCount: newFiles.length,
    bytes: newFiles.reduce((acc, f) => acc + f.size, 0),
    copied,
  };
}

function emptyResult(backend: BackendInfo, state: 'skipped' | 'tooLarge' | 'failed'): MirrorResult {
  return {
    backendId: backend.id,
    label: backend.label,
    state,
    files: 0,
    bytes: 0,
    copied: 0,
  };
}

async function executeRefresh(
  deps: MirrorDeps,
  options: MirrorOptions,
  projectId: string,
  backend: BackendInfo,
): Promise<MirrorResult> {
  if (backend.status !== 'ok') {
    return emptyResult(backend, 'skipped');
  }
  try {
    const scanRes = await scanBackend(deps.fs, backend.resolvedPath, options);
    if (scanRes.kind === 'tooLarge') {
      await removeMirrorAndManifest(deps.fs, deps.cacheDir, projectId, backend.id);
      return emptyResult(backend, 'tooLarge');
    }
    const syncRes = await syncScannedBackend(deps, projectId, backend, scanRes.files);
    return {
      backendId: backend.id,
      label: backend.label,
      state: 'ready',
      dir: join(deps.cacheDir, 'mirrors', projectId, backend.id),
      files: syncRes.filesCount,
      bytes: syncRes.bytes,
      copied: syncRes.copied,
    };
  } catch (err) {
    // S-89: the error name only; messages can carry backend file paths.
    const error = err instanceof Error ? err.name : 'unknown';
    deps.logger.warn({ backendId: backend.id, error }, 'Mirror refresh failed');
    return emptyResult(backend, 'failed');
  }
}

export function createMirrorService(deps: MirrorDeps, options: MirrorOptions = {}): MirrorService {
  return {
    remove: (projectId, backendId) =>
      removeMirrorAndManifest(deps.fs, deps.cacheDir, projectId, backendId),
    check: (projectId, backendId) => executeCheck(deps.fs, deps.cacheDir, projectId, backendId),
    refresh: (projectId, backend) => executeRefresh(deps, options, projectId, backend),
  };
}
