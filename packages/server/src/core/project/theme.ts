// Read and edit Tailwind v4 @theme tokens from the main CSS file (SPEC-04 R-PJ-17, R-TH-10 to R-TH-14).
import type { ThemeEdit, ThemeInfo, ThemeTokenKind, ThemeUsage } from '@kumicraft/shared';
import { err, type Result } from '@kumicraft/shared';

import {
  countUsage,
  editTokens,
  pushThemeHistory,
  recordWrite,
  type TokenFiles,
} from '../style/tokens/token-service.ts';
import { readThemeTokens } from '../style/tokens/tokens-tailwind4.ts';
import type { ProjectServiceDeps, WorkspaceState } from './project-types.ts';

export { pushThemeHistory, readThemeTokens, recordWrite };

function toTokenFiles(state: WorkspaceState & { status: 'open' }): TokenFiles {
  return {
    root: state.root,
    styling: state.support.styling,
    tailwindCss: state.support.tailwindCss,
    sourceDir: state.file.sourceDir,
  };
}

export async function editProjectTheme(
  current: WorkspaceState,
  deps: ProjectServiceDeps,
  edit: ThemeEdit,
): Promise<Result<ThemeInfo>> {
  if (current.status !== 'open') {
    return err({ code: 'E021', params: { missing: 'project' } });
  }
  const cssPath = current.support.tailwindCss;
  if (!cssPath || current.support.styling?.editable === false) {
    return err({ code: 'E021', params: { missing: 'styleAdapter' } });
  }
  const files = toTokenFiles(current);
  return editTokens(deps, files, 'tailwind4', edit);
}

export async function countProjectThemeUsage(
  current: WorkspaceState,
  deps: ProjectServiceDeps,
  kind: ThemeTokenKind,
  name: string,
): Promise<Result<ThemeUsage>> {
  if (current.status !== 'open') {
    return err({ code: 'E021', params: { missing: 'project' } });
  }
  const files = toTokenFiles(current);
  return countUsage(deps, files, 'tailwind4', kind, name);
}
