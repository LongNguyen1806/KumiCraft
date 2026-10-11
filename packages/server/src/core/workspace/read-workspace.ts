// Reading a workspace (SPEC-04.1 section 2.3): read every file, migrate, back up, validate.
// R-WS-01: one broken file puts the whole workspace in `error`; nothing is opened in part.
import {
  type AppError,
  assembleDocument,
  checkDocument,
  type DesignDocument,
  documentToFiles,
  type ErrorDetail,
  migrateWorkspace,
  type Migration,
  MIGRATIONS,
  WORKSPACE_DIR,
  workspaceFilePath,
  type WorkspaceFiles,
} from '@reactcraft/model';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { jsonDepth, MAX_JSON_DEPTH } from '../shared/paths.ts';
import { err, ok, type Result } from '../shared/result.ts';
import { BACKUP_DIR, backupStamp } from './backups.ts';

/** One file that stops the workspace from opening (R-WS-02 lists them). */
export type FileProblem = { readonly file: string; readonly error: AppError };

export type WorkspaceLoad =
  | {
      readonly status: 'open';
      readonly document: DesignDocument;
      readonly warnings: readonly string[];
      /** Version found on disk when a migration ran. */
      readonly migratedFrom?: number;
    }
  | { readonly status: 'error'; readonly problems: readonly FileProblem[] };

const ID_FILE = /^([a-z]_[A-Za-z0-9_-]{10})\.json$/;

async function readJson(fs: FileSystemPort, root: string, file: string): Promise<Result<unknown>> {
  const read = await fs.readText(root, file);
  if (!read.ok) return err({ ...read.error, params: { ...read.error.params, file } });
  if (jsonDepth(read.value) > MAX_JSON_DEPTH) {
    return err({ code: 'E004', params: { file, reason: 'tooDeep' } });
  }
  try {
    return ok(JSON.parse(read.value) as unknown);
  } catch (cause) {
    return err({ code: 'E004', params: { file }, details: [{ message: 'Invalid JSON' }], cause });
  }
}

type FileReader = {
  readonly problems: FileProblem[];
  /** Relative paths of every file read, for the migration backup. */
  readonly read: string[];
  one(file: string): Promise<unknown>;
  folder(folder: 'pages' | 'components'): Promise<Record<string, unknown>>;
};

function createReader(fs: FileSystemPort, root: string): FileReader {
  const reader: FileReader = {
    problems: [],
    read: [],
    async one(file) {
      const value = await readJson(fs, root, file);
      if (!value.ok) {
        reader.problems.push({ file, error: value.error });
        return undefined;
      }
      reader.read.push(file);
      return value.value;
    },
    async folder(folder) {
      const dir = `${WORKSPACE_DIR}/${folder}`;
      const entries = await fs.readDir(root, dir);
      if (!entries.ok) {
        if (entries.error.code !== 'E015')
          reader.problems.push({ file: dir, error: entries.error });
        return {};
      }
      const files: Record<string, unknown> = {};
      for (const entry of entries.value) {
        const id = ID_FILE.exec(entry.name)?.[1];
        if (entry.kind === 'file' && id !== undefined)
          files[id] = await reader.one(`${dir}/${entry.name}`);
      }
      return files;
    },
  };
  return reader;
}

/** Maps a validation detail (`pages.p_x.root...`) to the file that holds it. */
function fileOf(detail: ErrorDetail): string {
  const [head, id] = (detail.path ?? '').split('.');
  if (head === 'pages' && id !== undefined) return workspaceFilePath.page(id);
  if (head === 'components' && id !== undefined) return workspaceFilePath.component(id);
  if (head === 'tokens') return workspaceFilePath.tokens();
  if (head === 'dataSources') return workspaceFilePath.dataSources();
  return workspaceFilePath.workspace();
}

function problemsOf(error: AppError): FileProblem[] {
  const byFile = new Map<string, ErrorDetail[]>();
  for (const detail of error.details ?? []) {
    const file = fileOf(detail);
    byFile.set(file, [...(byFile.get(file) ?? []), detail]);
  }
  if (byFile.size === 0) return [{ file: workspaceFilePath.workspace(), error }];
  return [...byFile].map(([file, details]) => ({
    file,
    error: { code: error.code, params: { file }, details },
  }));
}

/** Copies the files as they were, then writes the migrated document in canonical form. */
async function persistMigration(
  fs: FileSystemPort,
  root: string,
  files: readonly string[],
  document: DesignDocument,
  now: Date,
): Promise<Result<void>> {
  const target = `${BACKUP_DIR}/migration-${backupStamp(now)}`;
  for (const file of files) {
    const copied = await fs.copy(root, file, `${target}/${file.slice(WORKSPACE_DIR.length + 1)}`);
    if (!copied.ok) return copied;
  }
  for (const [file, text] of Object.entries(documentToFiles(document))) {
    const written = await fs.writeTextAtomic(root, file, text);
    if (!written.ok) return written;
  }
  return ok(undefined);
}

export async function loadWorkspace(
  fs: FileSystemPort,
  root: string,
  now: Date,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<WorkspaceLoad> {
  const reader = createReader(fs, root);
  const files: WorkspaceFiles = {
    workspace: await reader.one(workspaceFilePath.workspace()),
    tokens: await reader.one(workspaceFilePath.tokens()),
    dataSources: await reader.one(workspaceFilePath.dataSources()),
    pages: await reader.folder('pages'),
    components: await reader.folder('components'),
  };
  if (reader.problems.length > 0) return { status: 'error', problems: reader.problems };

  const migrated = migrateWorkspace(files, migrations);
  if (!migrated.ok) {
    return {
      status: 'error',
      problems: [{ file: workspaceFilePath.workspace(), error: migrated.error }],
    };
  }
  const assembled = assembleDocument(migrated.value.files);
  const checked = checkDocument(assembled.document);
  if (!checked.ok) return { status: 'error', problems: problemsOf(checked.error) };

  if (migrated.value.migrated) {
    const persisted = await persistMigration(fs, root, reader.read, checked.value, now);
    if (!persisted.ok) {
      return { status: 'error', problems: [{ file: WORKSPACE_DIR, error: persisted.error }] };
    }
  }
  return {
    status: 'open',
    document: checked.value,
    warnings: assembled.warnings,
    ...(migrated.value.migrated ? { migratedFrom: migrated.value.from } : {}),
  };
}
