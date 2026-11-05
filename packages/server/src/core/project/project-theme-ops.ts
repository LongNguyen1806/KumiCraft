// Theme operations for ProjectService (SPEC-04 M-TH, WP-4.00).
import {
  err,
  primarySystem,
  type Result,
  type ThemeEdit,
  type ThemeInfo,
  type ThemeTokenKind,
  type ThemeUsage,
} from '@kumicraft/shared';

import {
  countUsage,
  editTokens,
  readTokens,
  type TokenFiles,
} from '../style/tokens/token-service.ts';
import type { ProjectServiceDeps, WorkspaceState } from './project-types.ts';

export function tokenFilesOf(current: WorkspaceState): TokenFiles | undefined {
  if (current.status !== 'open') return undefined;
  return {
    root: current.root,
    styling: current.support.styling,
    tailwindCss: current.support.tailwindCss,
    sourceDir: current.file.sourceDir,
    tokenFile: current.file.styleFiles?.tokenFile,
  };
}

export function readProjectTheme(
  deps: ProjectServiceDeps,
  current: WorkspaceState,
): Promise<Result<ThemeInfo>> {
  const f = tokenFilesOf(current);
  return f
    ? readTokens(deps, f, primarySystem(f.styling))
    : Promise.resolve(err({ code: 'E021', params: { missing: 'project' } }));
}

export function editProjectTheme(
  deps: ProjectServiceDeps,
  current: WorkspaceState,
  edit: ThemeEdit,
): Promise<Result<ThemeInfo>> {
  if (current.status === 'open' && current.support.editMode === 'viewOnly') {
    return Promise.resolve(err({ code: 'E023', params: { reason: 'viewOnly' } }));
  }
  const f = tokenFilesOf(current);
  const missing = () =>
    Promise.resolve(err({ code: 'E021' as const, params: { missing: 'project' } }));
  return f ? editTokens(deps, f, primarySystem(f.styling), edit) : missing();
}

export function queryThemeUsage(
  deps: ProjectServiceDeps,
  current: WorkspaceState,
  kind: ThemeTokenKind,
  name: string,
): Promise<Result<ThemeUsage>> {
  const f = tokenFilesOf(current);
  const missing = () =>
    Promise.resolve(err({ code: 'E021' as const, params: { missing: 'project' } }));
  return f ? countUsage(deps, f, primarySystem(f.styling), kind, name) : missing();
}
