// Project endpoints (SPEC-03 section 5.3, SPEC-04 M-PJ).
import {
  type AddPage,
  type BackendInfo,
  BackendInfoSchema,
  type ComponentPropsRequest,
  type ComponentPropsResponse,
  ComponentPropsResponseSchema,
  type CreateDraft,
  type DataSourceFieldsRequest,
  type DataSourceFieldsResponse,
  DataSourceFieldsResponseSchema,
  type DataSourceListResponse,
  DataSourceListResponseSchema,
  type DeletePage,
  type DesignDirs,
  type DirectoryListing,
  DirectoryListingSchema,
  type DraftFile,
  type DraftsInfo,
  DraftsInfoSchema,
  type ExtractComponent,
  type JobStarted,
  JobStartedSchema,
  type LoginSession,
  type PackageManager,
  type PagesInfo,
  PagesInfoSchema,
  type ProjectComponent,
  ProjectComponentsSchema,
  ProjectDirsResponseSchema,
  type ProjectInfo,
  ProjectInfoSchema,
  type ProjectProbe,
  ProjectProbeSchema,
  type PromoteDraft,
  type RecentProject,
  RecentProjectsSchema,
  type RenameDraft,
  type RenamePage,
  type Routing,
  type SessionInfo,
  SessionInfoSchema,
  type StructureResult,
  StructureResultSchema,
  type StyleFiles,
  type ThemeEdit,
  type ThemeInfo,
  ThemeInfoSchema,
  type ThemeTokenKind,
  type ThemeUsage,
  ThemeUsageSchema,
  type WorkspaceAi,
} from '@kumicraft/shared';

import { apiDelete, apiGet, apiPatch, apiPost, parseResponse } from './http.ts';

/** S-80: saves the trust decision for the open project and returns the new session. */
export async function setProjectTrust(trusted: boolean): Promise<SessionInfo> {
  return parseResponse(SessionInfoSchema, await apiPost('project/trust', { trusted }));
}

export async function probeProject(path: string): Promise<ProjectProbe> {
  return parseResponse(
    ProjectProbeSchema,
    await apiGet(`project/probe?path=${encodeURIComponent(path)}`),
  );
}

/** R-PJ-25: projects opened before that still exist, newest first. */
/** Takes a project off the recent list (the folder stays as it is). */
export async function forgetRecentProject(path: string): Promise<void> {
  await apiPost('project/recent/forget', { path });
}

export async function fetchRecentProjects(): Promise<readonly RecentProject[]> {
  return parseResponse(RecentProjectsSchema, await apiGet('project/recent'));
}

export async function openProject(path: string): Promise<ProjectInfo> {
  return parseResponse(ProjectInfoSchema, await apiPost('project/open', { path }));
}

export async function createProject(
  path: string,
  name: string,
  packageManager?: PackageManager,
): Promise<ProjectInfo> {
  return parseResponse(
    ProjectInfoSchema,
    await apiPost('project/create', { path, name, packageManager }),
  );
}

/** R-RN-27: saves the Canvas dev port; 'auto' goes back to the project's own. */
export async function saveDevPort(devPort: number | 'auto'): Promise<ProjectInfo> {
  return parseResponse(ProjectInfoSchema, await apiPatch('project', { devPort }));
}

export async function fetchProject(): Promise<ProjectInfo> {
  return parseResponse(ProjectInfoSchema, await apiGet('project'));
}

export async function closeProject(): Promise<void> {
  await apiPost('project/close');
}

/** Starts installing dependencies; progress comes as `job.*` events (R-PJ-13). */
export async function installProject(command: readonly string[]): Promise<JobStarted> {
  return parseResponse(JobStartedSchema, await apiPost('project/install', { command }));
}

/** Pages read from the project's router (R-PG-10, R-PG-15). */
export async function fetchPages(): Promise<PagesInfo> {
  return parseResponse(PagesInfoSchema, await apiGet('project/pages'));
}

export async function fetchProjectTheme(): Promise<ThemeInfo> {
  return parseResponse(ThemeInfoSchema, await apiGet('project/theme'));
}

export async function editTheme(edit: ThemeEdit): Promise<ThemeInfo> {
  return parseResponse(ThemeInfoSchema, await apiPatch('project/theme', edit));
}

export async function fetchThemeUsage(kind: ThemeTokenKind, name: string): Promise<ThemeUsage> {
  const qs = `kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(name)}`;
  return parseResponse(ThemeUsageSchema, await apiGet(`project/theme/usage?${qs}`));
}

export async function addProjectBackend(path: string, label?: string): Promise<BackendInfo> {
  return parseResponse(BackendInfoSchema, await apiPost('project/backends', { path, label }));
}

export async function removeProjectBackend(id: string): Promise<void> {
  await apiDelete(`project/backends/${id}`);
}

export async function fetchDirectories(path?: string): Promise<DirectoryListing> {
  const url = path ? `fs/directories?path=${encodeURIComponent(path)}` : 'fs/directories';
  return parseResponse(DirectoryListingSchema, await apiGet(url));
}

export async function saveDesignDirs(
  designDirs: DesignDirs,
  styleFiles?: StyleFiles,
): Promise<ProjectInfo> {
  const payload: { designDirs: DesignDirs; styleFiles?: StyleFiles } = { designDirs };
  if (styleFiles !== undefined) {
    payload.styleFiles = styleFiles;
  }
  return parseResponse(ProjectInfoSchema, await apiPatch('project', payload));
}

export async function patchProject(payload: {
  readonly designDirs?: DesignDirs | undefined;
  readonly styleFiles?: StyleFiles | undefined;
  readonly routing?: Routing | undefined;
  readonly sessions?: readonly LoginSession[] | undefined;
  readonly ai?: WorkspaceAi | undefined;
}): Promise<ProjectInfo> {
  return parseResponse(ProjectInfoSchema, await apiPatch('project', payload));
}

/** M-BC: starts the build check job; its result comes with the job. */
export async function startBuildCheck(): Promise<JobStarted> {
  return parseResponse(JobStartedSchema, await apiPost('project/build-check', {}));
}

export async function installProjectRouter(): Promise<JobStarted> {
  return parseResponse(JobStartedSchema, await apiPost('project/router/install', {}));
}

export async function fetchProjectDirs(): Promise<string[]> {
  return parseResponse(ProjectDirsResponseSchema, await apiGet('project/dirs')).dirs;
}

export async function addProjectPage(payload: AddPage): Promise<StructureResult> {
  return parseResponse(StructureResultSchema, await apiPost('project/pages', payload));
}

export async function renameProjectPage(payload: RenamePage): Promise<StructureResult> {
  return parseResponse(StructureResultSchema, await apiPatch('project/pages', payload));
}

export async function deleteProjectPage(payload: DeletePage): Promise<StructureResult> {
  return parseResponse(StructureResultSchema, await apiDelete('project/pages', payload));
}

export async function fetchComponents(): Promise<ProjectComponent[]> {
  return parseResponse(ProjectComponentsSchema, await apiGet('project/components')).components;
}

export async function extractComponent(payload: ExtractComponent): Promise<StructureResult> {
  return parseResponse(StructureResultSchema, await apiPost('project/components/extract', payload));
}

export async function fetchDrafts(): Promise<DraftsInfo> {
  return parseResponse(DraftsInfoSchema, await apiGet('project/drafts'));
}

export async function createDraft(payload: CreateDraft): Promise<StructureResult> {
  return parseResponse(StructureResultSchema, await apiPost('project/drafts', payload));
}

export async function renameDraft(payload: RenameDraft): Promise<StructureResult> {
  return parseResponse(StructureResultSchema, await apiPatch('project/drafts', payload));
}

export async function duplicateDraft(payload: DraftFile): Promise<StructureResult> {
  return parseResponse(StructureResultSchema, await apiPost('project/drafts/duplicate', payload));
}

export async function deleteDraft(payload: DraftFile): Promise<StructureResult> {
  return parseResponse(StructureResultSchema, await apiDelete('project/drafts', payload));
}

export async function promoteDraft(payload: PromoteDraft): Promise<StructureResult> {
  return parseResponse(StructureResultSchema, await apiPost('project/drafts/promote', payload));
}

export async function fetchDataSources(): Promise<DataSourceListResponse> {
  return parseResponse(DataSourceListResponseSchema, await apiGet('project/data-sources'));
}

export async function fetchDataSourceFields(
  payload: DataSourceFieldsRequest,
): Promise<DataSourceFieldsResponse> {
  return parseResponse(
    DataSourceFieldsResponseSchema,
    await apiPost('project/data-sources/fields', payload),
  );
}

export async function fetchComponentProps(
  payload: ComponentPropsRequest,
): Promise<ComponentPropsResponse> {
  return parseResponse(
    ComponentPropsResponseSchema,
    await apiPost('project/component-props', payload),
  );
}

export const SESSION_PROBE_TIMEOUT_MS = 3_000;

const probedOrigins = new Set<string>();

export function resetSessionProbeCache(): void {
  probedOrigins.clear();
}

export async function probeSessionOrigin(targetOrigin: string): Promise<boolean> {
  if (probedOrigins.has(targetOrigin)) return true;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, SESSION_PROBE_TIMEOUT_MS);
  try {
    await fetch(targetOrigin, { mode: 'no-cors', signal: controller.signal });
    probedOrigins.add(targetOrigin);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
