// Workspace file loading, creation and reload helpers (M-PJ, S-84).
import type {
  DesignDirs,
  Frame,
  LoginSession,
  ResponsiveMode,
  Routing,
  StyleFiles,
  StyleSystemId,
  WorkspaceAi,
} from '@kumicraft/shared';
import {
  LoginSessionsSchema,
  newWorkspaceFile,
  normalizeDesignDirs,
  primarySystem,
  serializeWorkspaceFile,
  type SupportReport,
  WORKSPACE_FILE,
  type WorkspaceFile,
} from '@kumicraft/shared';
import { nanoid } from 'nanoid';

import { writeOwnFile } from '../../kernel/own-files.ts';
import { err, ok, type Result } from '../../kernel/result.ts';
import type { Platform } from '../../kernel/session.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import type { LoggerPort } from '../../ports/logger-port.ts';
import type { SystemPort } from '../../ports/system-port.ts';
import type { ConfigStore } from '../config/user-config.ts';
import { readWorkspaceFile } from '../workspace/read-workspace.ts';
import { trustKeyOf } from '../workspace/trust.ts';
import { detectResponsiveMode } from './detect-responsive.ts';
import { computeBackendInfos } from './project-backends.ts';
import { validateDesignDirs, validateStyleFiles } from './project-dirs.ts';
import type { OpenWorkspace } from './project-types.ts';

export type PatchWorkspaceUpdates = {
  readonly name?: string | undefined;
  readonly responsiveMode?: ResponsiveMode | undefined;
  readonly frames?: readonly Frame[] | undefined;
  readonly primaryFrameId?: string | undefined;
  readonly devPort?: number | 'auto' | undefined;
  readonly designDirs?: DesignDirs | undefined;
  readonly styleFiles?: StyleFiles | undefined;
  readonly routing?: Routing | undefined;
  readonly sessions?: readonly LoginSession[] | undefined;
  readonly ai?: WorkspaceAi | undefined;
};

function buildPatchedWorkspaceFile(
  currentFile: WorkspaceFile,
  updates: PatchWorkspaceUpdates,
): WorkspaceFile {
  const { devPort: savedPort, routing: savedRouting, ...file } = currentFile;
  const devPort = updates.devPort === 'auto' ? undefined : (updates.devPort ?? savedPort);

  let savedDesignDirs = file.designDirs;
  if (updates.designDirs !== undefined) {
    const normalized = normalizeDesignDirs(updates.designDirs);
    savedDesignDirs = {
      pages: [...normalized.pages],
      layouts: [...normalized.layouts],
      components: [...normalized.components],
      ...(updates.designDirs.drafts !== undefined ? { drafts: updates.designDirs.drafts } : {}),
    };
  }

  let routing = savedRouting;
  if (updates.routing !== undefined) {
    routing = updates.routing.file !== undefined ? { file: updates.routing.file } : undefined;
  }

  const sessions = updates.sessions ? [...updates.sessions] : file.sessions;
  const ai = updates.ai ?? file.ai;

  return {
    ...file,
    name: updates.name ?? file.name,
    responsiveMode: updates.responsiveMode ?? file.responsiveMode,
    frames: updates.frames ? [...updates.frames] : file.frames,
    primaryFrameId: updates.primaryFrameId ?? file.primaryFrameId,
    ...(devPort === undefined ? {} : { devPort }),
    ...(savedDesignDirs !== undefined ? { designDirs: savedDesignDirs } : {}),
    ...(updates.styleFiles !== undefined
      ? { styleFiles: updates.styleFiles }
      : file.styleFiles
        ? { styleFiles: file.styleFiles }
        : {}),
    ...(routing !== undefined ? { routing } : {}),
    ...(sessions !== undefined ? { sessions } : {}),
    ...(ai !== undefined ? { ai } : {}),
  };
}

export async function executePatchWorkspaceFile(
  fs: FileSystemPort,
  root: string,
  currentFile: WorkspaceFile,
  sourceDir: string,
  platform: Platform,
  updates: PatchWorkspaceUpdates,
  primarySystem?: StyleSystemId,
): Promise<Result<WorkspaceFile>> {
  if (updates.designDirs !== undefined) {
    if (!validateDesignDirs(updates.designDirs, sourceDir, platform)) {
      return err({ code: 'E016', params: { reason: 'designDirs' } });
    }
  }

  if (updates.sessions !== undefined) {
    if (!LoginSessionsSchema.safeParse(updates.sessions).success) {
      return err({ code: 'E016', params: { reason: 'sessions' } });
    }
  }

  if (updates.styleFiles !== undefined) {
    const validStyle = await validateStyleFiles(
      fs,
      root,
      updates.styleFiles,
      sourceDir,
      primarySystem,
      platform,
    );
    if (!validStyle.ok) return validStyle;
  }

  const updatedFile = buildPatchedWorkspaceFile(currentFile, updates);
  const write = await writeOwnFile(fs, root, WORKSPACE_FILE, serializeWorkspaceFile(updatedFile));
  if (!write.ok) return write;
  return ok(updatedFile);
}

export type WorkspaceFileDeps = {
  readonly fs: FileSystemPort;
  readonly system: SystemPort;
};

export async function loadOrCreateWorkspaceFile(
  deps: WorkspaceFileDeps,
  root: string,
  support: SupportReport,
): Promise<Result<WorkspaceFile>> {
  if (await deps.fs.exists(root, WORKSPACE_FILE)) {
    return readWorkspaceFile(deps.fs, root);
  }
  const folderName = root.replaceAll('\\', '/').split('/').filter(Boolean).pop() ?? 'project';
  const truncatedName = folderName.slice(0, 64);
  const responsiveMode = await detectResponsiveMode(deps.fs, root, 'src');

  const file = newWorkspaceFile({
    id: nanoid(10),
    name: truncatedName,
    createdAt: deps.system.now().toISOString(),
    responsiveMode,
    framework: support.framework ?? 'vite-react',
    sourceDir: support.sourceDir ?? support.viewsDir ?? 'src',
    // A new project has no lock file yet: the choice made at creation must survive a restart.
    packageManager: support.packageManager,
  });

  const write = await writeOwnFile(deps.fs, root, WORKSPACE_FILE, serializeWorkspaceFile(file));
  if (!write.ok) return write;
  await writeOwnFile(deps.fs, root, '.kumicraft/.gitignore', 'lock\ncache/\n');
  return ok(file);
}

export type { OpenWorkspace };

export type ReloadWorkspaceDeps = {
  readonly fs: FileSystemPort;
  readonly platform: Platform;
  readonly homeDir?: string | undefined;
  readonly config: Pick<ConfigStore, 'isTrusted'>;
  readonly logger: LoggerPort;
};

/**
 * `workspace.json` changed on disk (project.changed, S-84): the state read again from it, or
 * undefined when it is unreadable or equal to what KumiCraft holds (its own write).
 */
export async function reloadOpenWorkspace(
  deps: ReloadWorkspaceDeps,
  state: OpenWorkspace,
): Promise<OpenWorkspace | undefined> {
  const read = await readWorkspaceFile(deps.fs, state.root);
  if (!read.ok) {
    deps.logger.warn({ code: read.error.code }, 'workspace.json changed but cannot be read');
    return undefined;
  }
  const file = read.value;
  if (serializeWorkspaceFile(file) === serializeWorkspaceFile(state.file)) return undefined;
  const trusted = deps.config.isTrusted(trustKeyOf(file, state.root));
  const backends = await computeBackendInfos(
    deps.fs,
    state.root,
    file,
    deps.platform,
    deps.homeDir,
  );
  return { ...state, file, trusted, backends };
}

export async function applyPatchProject(
  deps: Pick<ReloadWorkspaceDeps, 'fs' | 'platform'>,
  current: OpenWorkspace,
  updates: PatchWorkspaceUpdates,
): Promise<Result<OpenWorkspace>> {
  const primarySystemId = primarySystem(current.support.styling);
  const write = await executePatchWorkspaceFile(
    deps.fs,
    current.root,
    current.file,
    current.file.sourceDir,
    deps.platform,
    updates,
    primarySystemId,
  );
  if (!write.ok) return write;
  return ok({ ...current, file: write.value });
}

export async function applySetTrusted(
  deps: { readonly config: Pick<ConfigStore, 'setTrusted'> },
  current: OpenWorkspace,
  trusted: boolean,
): Promise<Result<OpenWorkspace>> {
  const saved = await deps.config.setTrusted(trustKeyOf(current.file, current.root), trusted);
  if (!saved.ok) return saved;
  return ok({ ...current, trusted });
}
