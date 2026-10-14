// Project lifecycle at startup: none → open | error, the session lock and trust (SPEC-03 section 3,
// SPEC-05 S-80 to S-84). Opening other folders, creating and probing projects come with M-PJ
// (WP-1.03); until then the server opens the folder given to the CLI.
import { WORKSPACE_FILE, type WorkspaceFile } from '@reactcraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { SystemPort } from '../ports/system-port.ts';
import { type AppError, err, ok, type Result } from '../shared/result.ts';
import type { ConfigStore } from '../shared/user-config.ts';
import { acquireLock, type LockInfo, releaseLock } from './lock.ts';
import { readWorkspaceFile } from './read-workspace.ts';
import { rememberPort } from './studio-port.ts';
import { trustKeyOf } from './trust.ts';

export type WorkspaceState =
  | { readonly status: 'none' }
  | {
      readonly status: 'open';
      readonly file: WorkspaceFile;
      /** S-80, S-81: an untrusted project runs in restricted mode. */
      readonly trusted: boolean;
    }
  | { readonly status: 'error'; readonly error: AppError };

export type WorkspaceServiceDeps = {
  readonly fs: FileSystemPort;
  /** Folder the CLI was started in. */
  readonly root: string;
  readonly system: SystemPort;
  readonly config: Pick<ConfigStore, 'isTrusted' | 'setTrusted'>;
  readonly logger: LoggerPort;
  /** Port of this server, written to the lock for a second CLI to print. */
  readonly port: number;
};

export type WorkspaceService = {
  state(): WorkspaceState;
  /** Startup: takes the lock and reads the project when `workspace.json` exists. E018 → exit. */
  open(): Promise<Result<WorkspaceState>>;
  /** Reads `workspace.json` again, for example after the user fixed it. */
  reload(): Promise<WorkspaceState>;
  setTrusted(trusted: boolean): Promise<Result<WorkspaceState>>;
  /** Shutdown: releases the lock. */
  close(): Promise<void>;
};

export function createWorkspaceService(deps: WorkspaceServiceDeps): WorkspaceService {
  let current: WorkspaceState = { status: 'none' };
  let held: LockInfo | undefined;
  const log = deps.logger.child({ module: 'M-PJ' });

  const lock = async (): Promise<Result<void>> => {
    if (held !== undefined) return ok(undefined);
    const taken = await acquireLock(deps.fs, deps.root, deps.system, deps.port);
    if (!taken.ok) return taken;
    held = taken.value;
    await rememberPort(deps.fs, deps.root, deps.port);
    return ok(undefined);
  };

  const load = async (): Promise<WorkspaceState> => {
    const read = await readWorkspaceFile(deps.fs, deps.root);
    if (!read.ok) {
      log.warn({ code: read.error.code, reason: read.error.params?.['reason'] }, 'project error');
      current = { status: 'error', error: read.error };
      return current;
    }
    const trusted = deps.config.isTrusted(trustKeyOf(read.value, deps.root));
    current = { status: 'open', file: read.value, trusted };
    return current;
  };

  return {
    state: () => current,

    async open() {
      if (!(await deps.fs.exists(deps.root, WORKSPACE_FILE))) return ok(current);
      const locked = await lock();
      return locked.ok ? ok(await load()) : locked;
    },

    reload: load,

    async setTrusted(trusted) {
      if (current.status !== 'open') return err({ code: 'E021', params: { missing: 'project' } });
      const saved = await deps.config.setTrusted(trustKeyOf(current.file, deps.root), trusted);
      if (!saved.ok) return saved;
      current = { ...current, trusted };
      return ok(current);
    },

    async close() {
      if (held !== undefined) await releaseLock(deps.fs, deps.root, held);
      held = undefined;
    },
  };
}
