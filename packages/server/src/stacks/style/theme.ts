// Read and edit Tailwind v4 @theme tokens from the main CSS file (SPEC-04 R-PJ-17, R-TH-10 to R-TH-14).
import type {
  RelPath,
  StylingReport,
  ThemeEdit,
  ThemeInfo,
  ThemeTokenKind,
  ThemeUsage,
} from '@kumicraft/shared';
import { err, type Result } from '@kumicraft/shared';

import type { TokenDeps } from '../../kernel/features.ts';
import {
  countUsage,
  editTokens,
  pushThemeHistory,
  recordWrite,
  type TokenFiles,
} from './tokens/token-service.ts';
import { readThemeTokens } from './tokens/tokens-tailwind4.ts';

export { pushThemeHistory, readThemeTokens, recordWrite };

/** What the theme tools need of the open project (the services' workspace state fits it). */
type ThemeProject = {
  readonly status: string;
  readonly root?: string | undefined;
  readonly support?:
    | {
        readonly styling?: StylingReport | undefined;
        readonly tailwindCss?: RelPath | undefined;
      }
    | undefined;
  readonly file?:
    | {
        readonly sourceDir: string;
        readonly styleFiles?: { readonly tokenFile?: RelPath | undefined } | undefined;
      }
    | undefined;
};

function toTokenFiles(state: ThemeProject): TokenFiles | undefined {
  if (state.status !== 'open' || !state.root || !state.support || !state.file) return undefined;
  return {
    root: state.root,
    styling: state.support.styling,
    tailwindCss: state.support.tailwindCss,
    sourceDir: state.file.sourceDir,
    tokenFile: state.file.styleFiles?.tokenFile,
  };
}

export async function editProjectTheme(
  current: ThemeProject,
  deps: TokenDeps,
  edit: ThemeEdit,
): Promise<Result<ThemeInfo>> {
  const files = toTokenFiles(current);
  if (files === undefined) return err({ code: 'E021', params: { missing: 'project' } });
  if (!files.tailwindCss || files.styling?.editable === false) {
    return err({ code: 'E021', params: { missing: 'styleAdapter' } });
  }
  return editTokens(deps, files, 'tailwind4', edit);
}

export async function countProjectThemeUsage(
  current: ThemeProject,
  deps: TokenDeps,
  kind: ThemeTokenKind,
  name: string,
): Promise<Result<ThemeUsage>> {
  const files = toTokenFiles(current);
  if (files === undefined) return err({ code: 'E021', params: { missing: 'project' } });
  return countUsage(deps, files, 'tailwind4', kind, name);
}
