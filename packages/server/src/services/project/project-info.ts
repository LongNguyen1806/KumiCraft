// ProjectInfo of the open project as the API returns it (SPEC-03 section 5.3).
import {
  normalizeDesignDirs,
  normalizeSessions,
  normalizeWorkspaceAi,
  type PackageManager,
  type ProjectInfo,
  type SupportReport,
  type WorkspaceFile,
} from '@kumicraft/shared';

import type { Platform } from '../../kernel/session.ts';
import { getInstallCommand } from './project-install.ts';
import type { OpenWorkspace } from './project-types.ts';

export type ProjectCapabilities = NonNullable<ProjectInfo['capabilities']>;

export function projectInfoOf(
  state: OpenWorkspace,
  capabilities?: ProjectCapabilities,
): ProjectInfo {
  return {
    id: state.file.id,
    name: state.file.name,
    root: state.root,
    sourceDir: state.file.sourceDir,
    support: state.support,
    needsInstall: state.needsInstall,
    installCommand: getInstallCommand(state.support.packageManager),
    responsiveMode: state.file.responsiveMode,
    frames: state.file.frames,
    primaryFrameId: state.file.primaryFrameId,
    backends: state.backends,
    trusted: state.trusted,
    ...(state.file.devPort === undefined ? {} : { devPort: state.file.devPort }),
    designDirs: normalizeDesignDirs(state.file.designDirs),
    ...(state.file.styleFiles !== undefined ? { styleFiles: state.file.styleFiles } : {}),
    sessions: normalizeSessions(state.file.sessions),
    ai: normalizeWorkspaceAi(state.file.ai),
    ...(capabilities === undefined ? {} : { capabilities }),
  };
}

export function normalizeRoot(path: string, platform: Platform): string {
  const unified = path.replaceAll('\\', '/').replace(/\/+$/, '');
  return platform === 'linux' ? unified : unified.toLowerCase();
}

export function resolveOpenSupport(
  root: string,
  baseSupport: SupportReport,
  createdPackageManagers: ReadonlyMap<string, PackageManager>,
  configSettingPm: PackageManager | undefined,
  platform: Platform,
): SupportReport {
  if (baseSupport.packageManager !== undefined) return baseSupport;
  const fromCreated = createdPackageManagers.get(normalizeRoot(root, platform));
  const resolvedPm = fromCreated ?? configSettingPm;
  return resolvedPm !== undefined ? { ...baseSupport, packageManager: resolvedPm } : baseSupport;
}

/**
 * The package manager of the lock file, then the one saved when the project was created, then
 * one the computer has (a project made by an older KumiCraft saved none).
 */
export async function withKnownPackageManager(
  support: SupportReport,
  file: Pick<WorkspaceFile, 'packageManager'>,
  deps: {
    readonly installedPackageManager?: (() => Promise<PackageManager | undefined>) | undefined;
  },
): Promise<SupportReport> {
  const saved = support.packageManager ?? file.packageManager;
  const packageManager = saved ?? (await deps.installedPackageManager?.());
  return packageManager === undefined ? support : { ...support, packageManager };
}
