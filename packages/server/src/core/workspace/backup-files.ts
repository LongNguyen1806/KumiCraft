// Backup files of a workspace (SPEC-04.1 section 3.3, R-DS-03 to R-DS-05, R-WS-02): named
// `<file key>.<stamp>.json` in `.reactcraft/backups/`. Independent of the Design Store, because the
// error screen restores files while no design is open.
import { WORKSPACE_DIR } from '@reactcraft/model';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { err, ok, type Result } from '../shared/result.ts';
import { BACKUP_DIR } from './backups.ts';

export type BackupSummary = {
  readonly id: string;
  /** Path of the backed-up file, relative to the workspace root. */
  readonly file: string;
  /** Time stamp from the name, `YYYYMMDD-HHmmss-SSS` (UTC). */
  readonly createdAt: string;
};

/**
 * `/` becomes `~`, which no file or id of the workspace contains. (`_` would be ambiguous: page ids
 * are `p_<10 chars>`.)
 */
export const backupKey = (path: string): string => path.replace(/\//g, '~');
const keyToPath = (key: string): string => key.replace(/~/g, '/');

export const backupName = (path: string, stamp: string): string =>
  `${backupKey(path)}.${stamp}.json`;

type Parsed = { readonly file: string; readonly createdAt: string };

function parseName(name: string): Parsed | undefined {
  if (!name.endsWith('.json')) return undefined;
  const base = name.slice(0, -'.json'.length);
  const lastDot = base.lastIndexOf('.');
  if (lastDot === -1) return undefined;
  const file = keyToPath(base.slice(0, lastDot));
  return file.startsWith(`${WORKSPACE_DIR}/`)
    ? { file, createdAt: base.slice(lastDot + 1) }
    : undefined;
}

/** Newest first. A missing backups folder is an empty list. */
export async function listBackups(
  fs: FileSystemPort,
  root: string,
): Promise<Result<readonly BackupSummary[]>> {
  const dir = await fs.readDir(root, BACKUP_DIR);
  if (!dir.ok) return dir;
  const backups: BackupSummary[] = [];
  for (const entry of dir.value) {
    const parsed = entry.kind === 'file' ? parseName(entry.name) : undefined;
    if (parsed !== undefined) backups.push({ id: entry.name, ...parsed });
  }
  backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return ok(backups);
}

/** Writes the backup over the file it came from. E015 for an unknown or malformed id. */
export async function restoreBackup(
  fs: FileSystemPort,
  root: string,
  id: string,
): Promise<Result<{ readonly file: string }>> {
  const parsed = id.includes('/') || id.includes('\\') ? undefined : parseName(id);
  if (parsed === undefined) return err({ code: 'E015', params: { resource: 'backup', id } });
  const read = await fs.readText(root, `${BACKUP_DIR}/${id}`);
  if (!read.ok) return read;
  const written = await fs.writeTextAtomic(root, parsed.file, read.value);
  return written.ok ? ok({ file: parsed.file }) : written;
}
