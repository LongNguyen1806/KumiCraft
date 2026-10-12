// Workspace lifecycle (SPEC-04.1 section 2.1): none → open | error, the session lock and trust.
import {
  type DesignDocument,
  documentToFiles,
  type ParsedCreateWorkspaceRequest,
  WORKSPACE_DIR,
  workspaceFilePath,
} from '@reactcraft/model';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { SystemPort } from '../ports/system-port.ts';
import { err, ok, type Result } from '../shared/result.ts';
import type { ConfigStore } from '../shared/user-config.ts';
import { createWorkspaceDocument } from './create-workspace.ts';
import { acquireLock, releaseLock } from './lock.ts';
import { type FileProblem, loadWorkspace } from './read-workspace.ts';

export type WorkspaceState =
  | { readonly status: 'none' }
  | {
      readonly status: 'open';
      readonly document: DesignDocument;
      readonly warnings: readonly string[];
      /** S-80, S-81: an untrusted workspace runs in restricted mode. */
      readonly trusted: boolean;
    }
  | { readonly status: 'error'; readonly problems: readonly FileProblem[] };

export type WorkspaceServiceDeps = {
  readonly fs: FileSystemPort;
  /** Folder the CLI was started in. */
  readonly root: string;
  readonly system: SystemPort;
  readonly config: Pick<ConfigStore, 'settings' | 'isTrusted' | 'setTrusted'>;
  readonly logger: LoggerPort;
  /** Port of this server, written to the lock for a second CLI to print. */
  readonly port: number;
  readonly newId: (size: number) => string;
};

export type WorkspaceService = {
  state(): WorkspaceState;
  /** Startup: takes the lock and reads the workspace when `.reactcraft/` exists. E018 → exit. */
  open(): Promise<Result<WorkspaceState>>;
  create(request: ParsedCreateWorkspaceRequest): Promise<Result<WorkspaceState>>;
  /** Reads the files again, for example after a restore or an external change. */
  reload(): Promise<WorkspaceState>;
  setTrusted(trusted: boolean): Promise<Result<WorkspaceState>>;
  /** Shutdown: releases the lock (the design store flushes before this). */
  close(): Promise<void>;
};

const ALREADY_EXISTS = err({ code: 'E018', params: { resource: 'workspace', reason: 'exists' } });

/**
 * Builds and writes a new workspace, workspace.json last so a folder without it is not mistaken
 * for a complete workspace. The user made it here, so it is trusted (S-80 asks only on open).
 */
async function writeNewWorkspace(
  deps: WorkspaceServiceDeps,
  request: ParsedCreateWorkspaceRequest,
  log: LoggerPort,
): Promise<Result<DesignDocument>> {
  if (await deps.fs.exists(deps.root, workspaceFilePath.workspace())) return ALREADY_EXISTS;
  const { language } = deps.config.settings();
  const document = createWorkspaceDocument(request, {
    newId: deps.newId,
    now: deps.system.now(),
    ...(language === undefined ? {} : { language }),
  });
  const files = Object.entries(documentToFiles(document));
  const main = workspaceFilePath.workspace();
  const ordered = [
    ...files.filter(([file]) => file !== main),
    ...files.filter(([file]) => file === main),
  ];
  for (const [file, text] of ordered) {
    const written = await deps.fs.writeTextAtomic(deps.root, file, text);
    if (!written.ok) return written;
  }
  const trusted = await deps.config.setTrusted(document.workspace.id, deps.root, true);
  if (!trusted.ok) log.warn({ code: trusted.error.code }, 'could not remember trust');
  return ok(document);
}

const openState = (
  deps: WorkspaceServiceDeps,
  document: DesignDocument,
  warnings: readonly string[],
): WorkspaceState => ({
  status: 'open',
  document,
  warnings,
  trusted: deps.config.isTrusted(document.workspace.id, deps.root),
});

async function readState(deps: WorkspaceServiceDeps, log: LoggerPort): Promise<WorkspaceState> {
  const loaded = await loadWorkspace(deps.fs, deps.root, deps.system.now());
  if (loaded.status === 'error') {
    log.warn({ files: loaded.problems.map((problem) => problem.file) }, 'workspace has errors');
    return loaded;
  }
  for (const warning of loaded.warnings) log.warn({}, warning);
  if (loaded.migratedFrom !== undefined)
    log.info({ from: loaded.migratedFrom }, 'workspace migrated');
  return openState(deps, loaded.document, loaded.warnings);
}

export function createWorkspaceService(deps: WorkspaceServiceDeps): WorkspaceService {
  let current: WorkspaceState = { status: 'none' };
  let isLocked = false;
  const log = deps.logger.child({ module: 'M-WS' });

  const lock = async (): Promise<Result<void>> => {
    if (isLocked) return ok(undefined);
    const taken = await acquireLock(deps.fs, deps.root, deps.system, deps.port);
    isLocked = taken.ok;
    return taken;
  };

  const load = async (): Promise<WorkspaceState> => {
    current = await readState(deps, log);
    return current;
  };

  return {
    state: () => current,

    async open() {
      if (!(await deps.fs.exists(deps.root, WORKSPACE_DIR))) return ok(current);
      const locked = await lock();
      return locked.ok ? ok(await load()) : locked;
    },

    async create(request) {
      if (current.status !== 'none') return ALREADY_EXISTS;
      const locked = await lock();
      if (!locked.ok) return locked;
      const created = await writeNewWorkspace(deps, request, log);
      if (!created.ok) return created;
      const document = created.value;
      log.info({ id: document.workspace.id }, 'workspace created');
      current = openState(deps, document, []);
      return ok(current);
    },

    reload: load,

    async setTrusted(trusted) {
      if (current.status !== 'open')
        return err({ code: 'E015', params: { resource: 'workspace' } });
      const saved = await deps.config.setTrusted(current.document.workspace.id, deps.root, trusted);
      if (!saved.ok) return saved;
      current = { ...current, trusted };
      return ok(current);
    },

    async close() {
      if (isLocked) await releaseLock(deps.fs, deps.root, deps.system);
      isLocked = false;
    },
  };
}
