// Project backends management (SPEC-04 M-PJ, V-03, V-04, V-05, R-PJ-14).
import {
  type BackendInfo,
  type BackendLink,
  serializeWorkspaceFile,
  WORKSPACE_FILE,
  type WorkspaceFile,
} from '@kumicraft/shared';
import { nanoid } from 'nanoid';

import { writeOwnFile } from '../../kernel/own-files.ts';
import {
  checkBlockedPath,
  checkPathSyntax,
  isInside,
  parentPath,
  resolveBackendPath,
  toStoredBackendPath,
} from '../../kernel/paths.ts';
import { err, ok, type Result } from '../../kernel/result.ts';
import type { Platform } from '../../kernel/session.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import type { ConfigStore } from '../config/user-config.ts';
import { trustKeyOf } from '../workspace/trust.ts';
import { projectInfoOf } from './project-info.ts';
import type { ProjectServiceDeps, WorkspaceState } from './project-types.ts';

export async function toBackendInfo(
  fs: FileSystemPort,
  root: string,
  link: BackendLink,
  platform: Platform,
  homeDir?: string,
): Promise<BackendInfo> {
  const resolvedPath = resolveBackendPath(root, link.path);
  const parent = parentPath(root);
  const outsideParent =
    parent === undefined
      ? !isInside(root, resolvedPath, platform)
      : !isInside(parent, resolvedPath, platform);
  const blocked = checkBlockedPath(resolvedPath, platform, homeDir);
  if (blocked !== undefined) {
    return { ...link, status: 'blocked', resolvedPath, outsideParent };
  }
  const exists = await fs.exists(resolvedPath, '.');
  if (!exists) {
    return { ...link, status: 'missing', resolvedPath, outsideParent };
  }
  return { ...link, status: 'ok', resolvedPath, outsideParent };
}

export async function computeBackendInfos(
  fs: FileSystemPort,
  root: string,
  file: WorkspaceFile,
  platform: Platform,
  homeDir?: string,
): Promise<BackendInfo[]> {
  return Promise.all(file.backends.map((b) => toBackendInfo(fs, root, b, platform, homeDir)));
}

export type BackendContext = {
  readonly fs: FileSystemPort;
  readonly platform: Platform;
  readonly homeDir?: string | undefined;
  readonly config: Pick<ConfigStore, 'setTrusted'>;
};

async function validateAddBackendPath(
  ctx: BackendContext,
  root: string,
  backendPath: string,
): Promise<Result<void>> {
  const syntaxErr = checkPathSyntax(backendPath, ctx.platform);
  if (syntaxErr !== undefined) return err(syntaxErr);

  const blockedErr = checkBlockedPath(backendPath, ctx.platform, ctx.homeDir);
  if (blockedErr !== undefined) return err(blockedErr);

  if (isInside(root, backendPath, ctx.platform) && isInside(backendPath, root, ctx.platform)) {
    return err({ code: 'E016', params: { reason: 'cannotMatchProjectRoot' } });
  }

  const dirCheck = await ctx.fs.readDir(backendPath, '.');
  if (!dirCheck.ok) {
    return err({ code: 'E015', params: { resource: 'directory', id: backendPath } });
  }

  return ok(undefined);
}

/** R-PJ-14: no duplicate of a linked backend, at most 10 backends (E016). */
function checkBackendSlot(
  root: string,
  currentFile: WorkspaceFile,
  storedPath: string,
): Result<undefined> {
  const resolvedTarget = resolveBackendPath(root, storedPath);
  if (
    currentFile.backends.some(
      (b) => b.path === storedPath || resolveBackendPath(root, b.path) === resolvedTarget,
    )
  ) {
    return err({ code: 'E016', params: { reason: 'duplicateBackend' } });
  }
  if (currentFile.backends.length >= 10) {
    return err({ code: 'E016', params: { reason: 'maxBackendsExceeded' } });
  }
  return ok(undefined);
}

export async function executeAddBackend(
  ctx: BackendContext,
  root: string,
  currentFile: WorkspaceFile,
  isTrusted: boolean,
  backendPath: string,
  customLabel?: string,
): Promise<
  Result<{
    readonly updatedFile: WorkspaceFile;
    readonly added: BackendInfo;
    readonly backends: readonly BackendInfo[];
  }>
> {
  // The project root is a real path (`open` resolves it): the backend must be one too, or a path
  // written another way (Windows 8.3 `RUNNER~1`, a link) is seen outside the parent (K10, CI).
  const realBackend = await ctx.fs.realRoot(backendPath);
  const valid = await validateAddBackendPath(ctx, root, realBackend);
  if (!valid.ok) return valid;

  const storedPath = toStoredBackendPath(root, realBackend, ctx.platform);
  const allowed = checkBackendSlot(root, currentFile, storedPath);
  if (!allowed.ok) return allowed;

  const folderName =
    backendPath.replaceAll('\\', '/').split('/').filter(Boolean).pop() ?? 'backend';
  const label = customLabel ?? folderName;

  const newBackend = {
    id: nanoid(10),
    path: storedPath,
    label,
  };

  const updatedFile: WorkspaceFile = {
    ...currentFile,
    backends: [...currentFile.backends, newBackend],
  };

  const write = await writeOwnFile(
    ctx.fs,
    root,
    WORKSPACE_FILE,
    serializeWorkspaceFile(updatedFile),
  );
  if (!write.ok) return write;

  if (isTrusted) {
    await ctx.config.setTrusted(trustKeyOf(updatedFile, root), true);
  }

  const backends = await computeBackendInfos(ctx.fs, root, updatedFile, ctx.platform, ctx.homeDir);
  const added =
    backends.find((b) => b.id === newBackend.id) ??
    (await toBackendInfo(ctx.fs, root, newBackend, ctx.platform, ctx.homeDir));

  return ok({ updatedFile, added, backends });
}

export async function executeRemoveBackend(
  ctx: BackendContext,
  root: string,
  currentFile: WorkspaceFile,
  isTrusted: boolean,
  id: string,
): Promise<
  Result<{ readonly updatedFile: WorkspaceFile; readonly backends: readonly BackendInfo[] }>
> {
  const existing = currentFile.backends.find((b) => b.id === id);
  if (!existing) {
    return err({ code: 'E015', params: { resource: 'backend', id } });
  }

  const updatedFile: WorkspaceFile = {
    ...currentFile,
    backends: currentFile.backends.filter((b) => b.id !== id),
  };

  const write = await writeOwnFile(
    ctx.fs,
    root,
    WORKSPACE_FILE,
    serializeWorkspaceFile(updatedFile),
  );
  if (!write.ok) return write;

  if (isTrusted) {
    await ctx.config.setTrusted(trustKeyOf(updatedFile, root), true);
  }

  const backends = await computeBackendInfos(ctx.fs, root, updatedFile, ctx.platform, ctx.homeDir);
  return ok({ updatedFile, backends });
}

export async function applyAddBackend(
  deps: ProjectServiceDeps,
  current: WorkspaceState,
  backendPath: string,
  customLabel?: string,
): Promise<Result<{ readonly next: WorkspaceState; readonly added: BackendInfo }>> {
  if (current.status !== 'open') {
    return err({ code: 'E021', params: { missing: 'project' } });
  }

  const res = await executeAddBackend(
    deps,
    current.root,
    current.file,
    current.trusted,
    backendPath,
    customLabel,
  );
  if (!res.ok) return res;

  const next: WorkspaceState = {
    ...current,
    file: res.value.updatedFile,
    backends: res.value.backends,
  };
  deps.eventBus?.publish('project.changed', projectInfoOf(next));
  if (current.trusted && res.value.added.status === 'ok') {
    void deps.mirror?.refresh(current.file.id, res.value.added).catch(() => undefined);
  }
  return ok({ next, added: res.value.added });
}

export async function applyRemoveBackend(
  deps: ProjectServiceDeps,
  current: WorkspaceState,
  id: string,
): Promise<Result<{ readonly next: WorkspaceState }>> {
  if (current.status !== 'open') {
    return err({ code: 'E021', params: { missing: 'project' } });
  }

  const res = await executeRemoveBackend(deps, current.root, current.file, current.trusted, id);
  if (!res.ok) return res;

  await deps.mirror?.remove(current.file.id, id);

  const next: WorkspaceState = {
    ...current,
    file: res.value.updatedFile,
    backends: res.value.backends,
  };
  deps.eventBus?.publish('project.changed', projectInfoOf(next));
  return ok({ next });
}
