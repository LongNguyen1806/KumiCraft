// Migration pipeline of workspace files (ADR-BE-11, SPEC-04.1 section 2.3 steps 2 and 3). Works on
// raw JSON before schema validation; the server backs files up before it writes the result.
import { err, ok, type Result } from '../result.ts';
import { SCHEMA_VERSION } from '../schema/document.schema.ts';

/** The JSON content of every file of `.reactcraft/`, as read from disk. */
export type WorkspaceFiles = {
  readonly workspace: unknown;
  readonly tokens: unknown;
  readonly dataSources: unknown;
  readonly pages: Readonly<Record<string, unknown>>;
  readonly components: Readonly<Record<string, unknown>>;
};

/** One upgrade step. `to` is greater than `from`; most steps go up by one. */
export type Migration = {
  readonly from: number;
  readonly to: number;
  readonly migrate: (files: WorkspaceFiles) => WorkspaceFiles;
};

/**
 * Registered upgrade steps. Schema 1 is the first version, so there is none yet. A schema change
 * after G1 adds a step here together with its upgrade test (SPEC-07 CW-29).
 */
export const MIGRATIONS: readonly Migration[] = [];

export type MigrationOutcome = {
  readonly files: WorkspaceFiles;
  /** Version found on disk. */
  readonly from: number;
  /** Version after the pipeline: the current schema version. */
  readonly to: number;
  /** Whether any step ran (the server then backs up and rewrites the files). */
  readonly migrated: boolean;
};

/** Version of a workspace: the `schemaVersion` of workspace.json. */
export function readSchemaVersion(files: WorkspaceFiles): number | undefined {
  const version = (files.workspace as { schemaVersion?: unknown } | undefined)?.schemaVersion;
  return typeof version === 'number' && Number.isInteger(version) && version >= 0
    ? version
    : undefined;
}

const stamp = (file: unknown, version: number): unknown =>
  file instanceof Object
    ? { ...(file as Readonly<Record<string, unknown>>), schemaVersion: version }
    : file;

/** Every file carries the workspace version once a step has run. */
function stampAll(files: WorkspaceFiles, version: number): WorkspaceFiles {
  const each = (record: Readonly<Record<string, unknown>>) =>
    Object.fromEntries(Object.entries(record).map(([id, file]) => [id, stamp(file, version)]));
  return {
    workspace: stamp(files.workspace, version),
    tokens: stamp(files.tokens, version),
    dataSources: stamp(files.dataSources, version),
    pages: each(files.pages),
    components: each(files.components),
  };
}

/**
 * Brings workspace files up to the current schema version.
 *
 * @returns The migrated files, or E004 when the version is missing, newer than this ReactCraft
 *   (`params.schemaVersion`, `params.supported`), has no upgrade path, or a step fails.
 */
export function migrateWorkspace(
  files: WorkspaceFiles,
  migrations: readonly Migration[] = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): Result<MigrationOutcome> {
  const from = readSchemaVersion(files);
  if (from === undefined) {
    return err({
      code: 'E004',
      params: { file: 'workspace.json' },
      details: [{ message: 'Missing or invalid schemaVersion' }],
    });
  }
  if (from > target) {
    return err({
      code: 'E004',
      params: { file: 'workspace.json', schemaVersion: from, supported: target },
    });
  }
  let current = files;
  let version = from;
  while (version < target) {
    const step = migrations.find((migration) => migration.from === version);
    if (step === undefined || step.to <= version || step.to > target) {
      return err({
        code: 'E004',
        params: { file: 'workspace.json', schemaVersion: version },
        details: [{ message: `No migration from version ${String(version)}` }],
      });
    }
    try {
      current = stampAll(step.migrate(current), step.to);
    } catch (cause) {
      return err({
        code: 'E004',
        params: { file: 'workspace.json', schemaVersion: version },
        cause,
      });
    }
    version = step.to;
  }
  return ok({ files: current, from, to: version, migrated: version !== from });
}
