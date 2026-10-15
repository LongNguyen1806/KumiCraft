// Project endpoints (SPEC-03 section 5.3, SPEC-04 M-PJ).
import type {
  BackendInfo,
  DirectoryListing,
  PackageManager,
  ProjectInfo,
  ProjectProbe,
  ThemeInfo,
} from '@reactcraft/shared';

import { apiDelete, apiGet, apiPost } from './http.ts';
import type { SessionInfo } from './session.ts';

/** S-80: saves the trust decision for the open project and returns the new session. */
export async function setProjectTrust(trusted: boolean): Promise<SessionInfo> {
  return (await apiPost('project/trust', { trusted })) as SessionInfo;
}

export async function probeProject(path: string): Promise<ProjectProbe> {
  return (await apiGet(`project/probe?path=${encodeURIComponent(path)}`)) as ProjectProbe;
}

export async function openProject(path: string): Promise<ProjectInfo> {
  return (await apiPost('project/open', { path })) as ProjectInfo;
}

export async function createProject(
  path: string,
  name: string,
  packageManager?: PackageManager,
): Promise<ProjectInfo> {
  return (await apiPost('project/create', { path, name, packageManager })) as ProjectInfo;
}

export async function fetchProject(): Promise<ProjectInfo> {
  return (await apiGet('project')) as ProjectInfo;
}

export async function closeProject(): Promise<void> {
  await apiPost('project/close');
}

export async function installProject(command: readonly string[]): Promise<void> {
  await apiPost('project/install', { command });
}

export async function fetchProjectTheme(): Promise<ThemeInfo> {
  return (await apiGet('project/theme')) as ThemeInfo;
}

export async function addProjectBackend(path: string, label?: string): Promise<BackendInfo> {
  return (await apiPost('project/backends', { path, label })) as BackendInfo;
}

export async function removeProjectBackend(id: string): Promise<void> {
  await apiDelete(`project/backends/${id}`);
}

export async function fetchDirectories(path?: string): Promise<DirectoryListing> {
  const url = path ? `fs/directories?path=${encodeURIComponent(path)}` : 'fs/directories';
  return (await apiGet(url)) as DirectoryListing;
}
