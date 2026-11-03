// ProjectInfo of the open project as the API returns it (SPEC-03 section 5.3).
import {
  normalizeDesignDirs,
  normalizeSessions,
  normalizeWorkspaceAi,
  type PackageManager,
  type ProjectInfo,
  type SupportReport,
} from '@kumicraft/shared';

import type { Platform } from '../shared/session.ts';
import { getInstallCommand } from './project-install.ts';
import type { OpenWorkspace } from './project-workspace-file.ts';

export function projectInfoOf(state: OpenWorkspace): ProjectInfo {
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
