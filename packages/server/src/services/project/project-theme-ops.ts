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

import type { TokenFiles } from '../../kernel/features.ts';
import type { Capability } from '../../kernel/stacks.ts';
import type { ProjectServiceDeps, WorkspaceState } from './project-types.ts';

/** The style stack was not given to the service (a test without it). */
const NO_TOKENS = err({ code: 'E021', params: { missing: 'styleAdapter' } });

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
  if (f === undefined)
    return Promise.resolve(err({ code: 'E021', params: { missing: 'project' } }));
  if (deps.themeTokens === undefined) return Promise.resolve(NO_TOKENS);
  return deps.themeTokens.read(deps, f, primarySystem(f.styling));
}

export function editProjectTheme(
  deps: ProjectServiceDeps,
  current: WorkspaceState,
  edit: ThemeEdit,
  capability: Capability,
): Promise<Result<ThemeInfo>> {
  if (!capability.edit) {
    return Promise.resolve(err({ code: 'E023', params: { reason: capability.reason } }));
  }
  const f = tokenFilesOf(current);
  const missing = () =>
    Promise.resolve(err({ code: 'E021' as const, params: { missing: 'project' } }));
  if (f === undefined) return missing();
  if (deps.themeTokens === undefined) return Promise.resolve(NO_TOKENS);
  return deps.themeTokens.edit(deps, f, primarySystem(f.styling), edit);
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
  if (f === undefined) return missing();
  if (deps.themeTokens === undefined) return Promise.resolve(NO_TOKENS);
  return deps.themeTokens.countUsage(deps, f, primarySystem(f.styling), kind, name);
}
