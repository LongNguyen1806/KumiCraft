// File operations for the Project File Tree (SPEC-04 K3b, spec-log #70).
import { posix } from 'node:path';

import { err, ok, type Result } from '@kumicraft/shared';

import { commitFileChanges, moveEntry, removeEntry } from '../../kernel/file-writer.ts';
import {
  computeBytesSha256,
  computeSha256,
  type HistoryService,
} from '../../kernel/history/history-service.ts';
import { isIgnoredPath } from '../../lib/file-tree.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';

export const MAX_DIR_FILES = 500;
export const MAX_DIR_BYTES = 20 * 1024 * 1024; // 20 MB

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.pdf',
  '.zip',
]);

type LoadedFileData = {
  readonly content: string;
  readonly hash: string;
  readonly encoding?: 'base64' | undefined;
  readonly size: number;
};

async function readFileData(
  fs: FileSystemPort,
  root: string,
  path: string,
): Promise<Result<LoadedFileData>> {
  const ext = posix.extname(path).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    const bytesRes = await fs.readBytes(root, path);
    if (!bytesRes.ok) return bytesRes;
    const base64 = Buffer.from(bytesRes.value).toString('base64');
    return ok({
      content: base64,
      hash: computeBytesSha256(bytesRes.value),
      encoding: 'base64',
      size: bytesRes.value.length,
    });
  }

  const textRes = await fs.readText(root, path, { keepBom: true });
  if (!textRes.ok) {
    const bytesRes = await fs.readBytes(root, path);
    if (!bytesRes.ok) return textRes;
    const base64 = Buffer.from(bytesRes.value).toString('base64');
    return ok({
      content: base64,
      hash: computeBytesSha256(bytesRes.value),
      encoding: 'base64',
      size: bytesRes.value.length,
    });
  }

  return ok({
    content: textRes.value,
    hash: computeSha256(textRes.value),
    size: Buffer.byteLength(textRes.value, 'utf8'),
  });
}

/**
 * Every file under `dir`, including folders the tree hides (`node_modules`, `.git`): the delete
 * or rename moves them too, so history and the size limit must count them.
 */
async function collectFilesRecursive(
  fs: FileSystemPort,
  root: string,
  dir: string,
): Promise<Result<readonly string[]>> {
  const results: string[] = [];
  const queue = [dir];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    const entriesRes = await fs.readDir(root, current);
    if (!entriesRes.ok) return entriesRes;

    for (const entry of entriesRes.value) {
      const childPath = `${current}/${entry.name}`;
      if (entry.kind === 'directory') {
        queue.push(childPath);
      } else {
        results.push(childPath);
      }
    }
  }

  return ok(results);
}

export type FileOpsDeps = {
  readonly fs: FileSystemPort;
  readonly history?: HistoryService | undefined;
};

export async function createFile(
  deps: FileOpsDeps,
  root: string,
  path: string,
  kind: 'file' | 'directory',
): Promise<Result<void>> {
  if (isIgnoredPath(path)) {
    return err({ code: 'E012', params: { path } });
  }
  if (await deps.fs.exists(root, path)) {
    return err({ code: 'E016', params: { reason: 'entryExists' } });
  }

  if (kind === 'directory') {
    return deps.fs.mkdir(root, path);
  }

  const parentDir = posix.dirname(path);
  if (parentDir && parentDir !== '.') {
    const mkdirRes = await deps.fs.mkdir(root, parentDir);
    if (!mkdirRes.ok) return mkdirRes;
  }

  const created = await commitFileChanges(deps, root, [{ path, before: undefined, after: '' }], {
    label: { key: 'history:fileCreate', params: { name: path } },
  });
  if (!created.ok) return created;

  return ok(undefined);
}

async function renameDirectoryFiles(
  deps: FileOpsDeps,
  root: string,
  from: string,
  to: string,
  files: readonly string[],
): Promise<Result<void>> {
  if (files.length > MAX_DIR_FILES) {
    return err({ code: 'E016', params: { reason: 'folderTooLarge', files: files.length } });
  }

  const fileDataList: { fromPath: string; toPath: string; data: LoadedFileData }[] = [];
  let totalBytes = 0;

  for (const fromPath of files) {
    const toPath = `${to}${fromPath.slice(from.length)}`;
    const dataRes = await readFileData(deps.fs, root, fromPath);
    if (!dataRes.ok) return dataRes;
    totalBytes += dataRes.value.size;
    if (totalBytes > MAX_DIR_BYTES) {
      return err({ code: 'E016', params: { reason: 'folderTooLarge', bytes: totalBytes } });
    }
    fileDataList.push({ fromPath, toPath, data: dataRes.value });
  }

  const moved = await moveEntry(
    deps,
    root,
    {
      from,
      to,
      files: fileDataList.map((item) => ({
        path: item.fromPath,
        content: item.data.content,
        encoding: item.data.encoding,
      })),
    },
    {
      label: { key: 'history:fileRename', params: { name: to } },
    },
  );
  if (!moved.ok) return moved;

  return ok(undefined);
}

async function renameSingleFile(
  deps: FileOpsDeps,
  root: string,
  from: string,
  to: string,
): Promise<Result<void>> {
  const fileData = await readFileData(deps.fs, root, from);
  if (!fileData.ok) return fileData;

  const moved = await moveEntry(
    deps,
    root,
    {
      from,
      to,
      files: [{ path: from, content: fileData.value.content, encoding: fileData.value.encoding }],
    },
    {
      label: { key: 'history:fileRename', params: { name: to } },
    },
  );
  if (!moved.ok) return moved;

  return ok(undefined);
}

export async function renameFileOrDir(
  deps: FileOpsDeps,
  root: string,
  from: string,
  to: string,
): Promise<Result<void>> {
  if (isIgnoredPath(from) || isIgnoredPath(to)) {
    return err({ code: 'E012', params: { path: isIgnoredPath(from) ? from : to } });
  }

  if (from !== to && from.toLowerCase() !== to.toLowerCase() && (await deps.fs.exists(root, to))) {
    return err({ code: 'E016', params: { reason: 'entryExists' } });
  }

  const statRes = await deps.fs.stat(root, from);
  if (!statRes.ok) return statRes;

  const toDir = posix.dirname(to);
  if (toDir && toDir !== '.') {
    await deps.fs.mkdir(root, toDir);
  }

  const dirRes = await deps.fs.readDir(root, from);
  if (dirRes.ok) {
    const allFilesRes = await collectFilesRecursive(deps.fs, root, from);
    if (!allFilesRes.ok) return allFilesRes;
    return renameDirectoryFiles(deps, root, from, to, allFilesRes.value);
  }

  return renameSingleFile(deps, root, from, to);
}

async function deleteDirectory(
  deps: FileOpsDeps,
  root: string,
  dir: string,
  files: readonly string[],
): Promise<Result<void>> {
  if (files.length > MAX_DIR_FILES) {
    return err({ code: 'E016', params: { reason: 'folderTooLarge', files: files.length } });
  }

  const fileDataList: { path: string; data: LoadedFileData }[] = [];
  let totalBytes = 0;

  for (const path of files) {
    const dataRes = await readFileData(deps.fs, root, path);
    if (!dataRes.ok) return dataRes;
    totalBytes += dataRes.value.size;
    if (totalBytes > MAX_DIR_BYTES) {
      return err({ code: 'E016', params: { reason: 'folderTooLarge', bytes: totalBytes } });
    }
    fileDataList.push({ path, data: dataRes.value });
  }

  const removed = await removeEntry(
    deps,
    root,
    {
      path: dir,
      files: fileDataList.map((item) => ({
        path: item.path,
        content: item.data.content,
        encoding: item.data.encoding,
      })),
    },
    { label: { key: 'history:fileDelete', params: { name: dir } } },
  );
  if (!removed.ok) return removed;

  return ok(undefined);
}

export async function deleteFileOrDir(
  deps: FileOpsDeps,
  root: string,
  path: string,
): Promise<Result<void>> {
  if (isIgnoredPath(path)) {
    return err({ code: 'E012', params: { path } });
  }

  const dirRes = await deps.fs.readDir(root, path);
  const isDirectory = dirRes.ok;

  if (isDirectory) {
    const allFilesRes = await collectFilesRecursive(deps.fs, root, path);
    if (!allFilesRes.ok) return allFilesRes;
    return deleteDirectory(deps, root, path, allFilesRes.value);
  }

  const fileData = await readFileData(deps.fs, root, path);
  if (!fileData.ok) return fileData;

  const removed = await removeEntry(
    deps,
    root,
    {
      path,
      files: [{ path, content: fileData.value.content, encoding: fileData.value.encoding }],
    },
    { label: { key: 'history:fileDelete', params: { name: path } } },
  );
  if (!removed.ok) return removed;

  return ok(undefined);
}
