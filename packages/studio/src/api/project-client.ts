// Project endpoints (SPEC-03 section 5.3, SPEC-04 M-PJ).
import {
  type AddPage,
  type BackendInfo,
  type DeletePage,
  type DesignDirs,
  type DirectoryListing,
  type JobStarted,
  JobStartedSchema,
  type PackageManager,
  type PagesInfo,
  PagesInfoSchema,
  type ProjectComponent,
  ProjectComponentsSchema,
  type ProjectInfo,
  ProjectInfoSchema,
  type ProjectProbe,
  type RenamePage,
  type StructureResult,
  StructureResultSchema,
  type ThemeInfo,
} from '@reactcraft/shared';

import { apiDelete, apiGet, apiPatch, apiPost } from './http.ts';
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

/** R-RN-27: saves the Canvas dev port; 'auto' goes back to the project's own. */
export async function saveDevPort(devPort: number | 'auto'): Promise<ProjectInfo> {
  return ProjectInfoSchema.parse(await apiPatch('project', { devPort }));
}

export async function fetchProject(): Promise<ProjectInfo> {
  return (await apiGet('project')) as ProjectInfo;
}

export async function closeProject(): Promise<void> {
  await apiPost('project/close');
}

/** Starts installing dependencies; progress comes as `job.*` events (R-PJ-13). */
export async function installProject(command: readonly string[]): Promise<JobStarted> {
  return JobStartedSchema.parse(await apiPost('project/install', { command }));
}

/** Pages read from the project's router (R-PG-10, R-PG-15). */
export async function fetchPages(): Promise<PagesInfo> {
  return PagesInfoSchema.parse(await apiGet('project/pages'));
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

export async function saveDesignDirs(designDirs: DesignDirs): Promise<ProjectInfo> {
  return ProjectInfoSchema.parse(await apiPatch('project', { designDirs }));
}

export async function fetchProjectDirs(): Promise<string[]> {
  const res = (await apiGet('project/dirs')) as { dirs: string[] };
  return res.dirs;
}

export async function addProjectPage(payload: AddPage): Promise<StructureResult> {
  return StructureResultSchema.parse(await apiPost('project/pages', payload));
}

export async function renameProjectPage(payload: RenamePage): Promise<StructureResult> {
  return StructureResultSchema.parse(await apiPatch('project/pages', payload));
}

export async function deleteProjectPage(payload: DeletePage): Promise<StructureResult> {
  return StructureResultSchema.parse(await apiDelete('project/pages', payload));
}

export async function fetchComponents(): Promise<ProjectComponent[]> {
  const res = (await apiGet('project/components')) as { components: ProjectComponent[] };
  return ProjectComponentsSchema.parse(res).components;
}
