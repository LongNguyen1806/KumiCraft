// Tailwind 4 @theme token adapter (SPEC-04 R-TH-10 to R-TH-14).
import type {
  RelPath,
  Result,
  ThemeEdit,
  ThemeInfo,
  ThemeToken,
  ThemeTokenKind,
} from '@kumicraft/shared';
import { err, ok } from '@kumicraft/shared';

import type { FileSystemPort } from '../../../ports/file-system-port.ts';
import { applyThemeEdit, countTokenUses } from '../theme-edit.ts';
import type { TokenAdapter, TokenFiles } from './token-types.ts';

const THEME_BLOCK_REGEX = /@theme\s*(?:inline)?\s*\{([^}]+)\}/g;
const CSS_VAR_REGEX = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;

type TokenBuckets = {
  readonly colors: ThemeToken[];
  readonly fontSizes: ThemeToken[];
  readonly radii: ThemeToken[];
  readonly fonts: ThemeToken[];
  readonly shadows: ThemeToken[];
  readonly breakpoints: ThemeToken[];
};

function parseVariablesFromBlock(blockBody: string, buckets: TokenBuckets): void {
  CSS_VAR_REGEX.lastIndex = 0;
  let varMatch: RegExpExecArray | undefined = CSS_VAR_REGEX.exec(blockBody) ?? undefined;
  while (varMatch !== undefined) {
    const rawName = varMatch[1];
    const rawVal = varMatch[2];
    if (rawName && rawVal) {
      const fullVarName = rawName.trim();
      const val = rawVal.trim();

      if (fullVarName.startsWith('color-')) {
        buckets.colors.push({ name: fullVarName.replace(/^color-/, ''), value: val });
      } else if (fullVarName.startsWith('text-')) {
        // R-PJ-17: skip --text-*--line-height
        if (!fullVarName.includes('--line-height')) {
          buckets.fontSizes.push({ name: fullVarName.replace(/^text-/, ''), value: val });
        }
      } else if (fullVarName.startsWith('radius-')) {
        buckets.radii.push({ name: fullVarName.replace(/^radius-/, ''), value: val });
      } else if (fullVarName.startsWith('font-')) {
        buckets.fonts.push({ name: fullVarName.replace(/^font-/, ''), value: val });
      } else if (fullVarName.startsWith('shadow-')) {
        buckets.shadows.push({ name: fullVarName.replace(/^shadow-/, ''), value: val });
      } else if (fullVarName.startsWith('breakpoint-')) {
        buckets.breakpoints.push({ name: fullVarName.replace(/^breakpoint-/, ''), value: val });
      }
    }
    varMatch = CSS_VAR_REGEX.exec(blockBody) ?? undefined;
  }
}

export async function readThemeTokens(
  fs: FileSystemPort,
  root: string,
  cssFilePath: string,
): Promise<Result<ThemeInfo>> {
  const read = await fs.readText(root, cssFilePath, { maxBytes: 1024 * 1024 });
  if (!read.ok) return read;

  const content = read.value;
  const buckets: TokenBuckets = {
    colors: [],
    fontSizes: [],
    radii: [],
    fonts: [],
    shadows: [],
    breakpoints: [],
  };

  THEME_BLOCK_REGEX.lastIndex = 0;
  let blockMatch: RegExpExecArray | undefined = THEME_BLOCK_REGEX.exec(content) ?? undefined;
  while (blockMatch !== undefined) {
    const blockBody = blockMatch[1];
    if (blockBody) {
      parseVariablesFromBlock(blockBody, buckets);
    }
    blockMatch = THEME_BLOCK_REGEX.exec(content) ?? undefined;
  }

  return ok({
    file: cssFilePath,
    ...buckets,
  });
}

function targetTailwind4File(files: TokenFiles): RelPath | undefined {
  if (files.tokenFile && files.tokenFile.endsWith('.css')) {
    return files.tokenFile;
  }
  return files.tailwindCss;
}

export const tailwind4Adapter: TokenAdapter = {
  system: 'tailwind4',
  async read(fs: FileSystemPort, files: TokenFiles): Promise<Result<ThemeInfo>> {
    const cssPath = targetTailwind4File(files);
    if (!cssPath) {
      return ok({
        system: 'tailwind4',
        colors: [],
        fontSizes: [],
        radii: [],
        fonts: [],
        shadows: [],
        breakpoints: [],
      });
    }
    const res = await readThemeTokens(fs, files.root, cssPath);
    if (!res.ok) return res;
    return ok({ ...res.value, system: 'tailwind4' });
  },

  async plan(
    fs: FileSystemPort,
    files: TokenFiles,
    edit: ThemeEdit,
  ): Promise<Result<{ readonly file: RelPath; readonly before: string; readonly after: string }>> {
    const cssPath = targetTailwind4File(files);
    if (!cssPath) {
      return err({ code: 'E021', params: { missing: 'styleAdapter' } });
    }
    const read = await fs.readText(files.root, cssPath, { maxBytes: 1024 * 1024, keepBom: true });
    if (!read.ok) return read;
    const edited = applyThemeEdit(read.value, edit);
    if (!edited.ok) return edited;
    return ok({ file: cssPath, before: read.value, after: edited.value });
  },

  countUses(source: string, _file: string, kind: ThemeTokenKind, token: ThemeToken): number {
    return countTokenUses(source, kind, token.name);
  },
};
