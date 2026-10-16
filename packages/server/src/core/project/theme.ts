// Read Tailwind v4 @theme tokens from the main CSS file (SPEC-04 R-PJ-17, SPEC-03 section 5.3).
import type { ThemeInfo, ThemeToken } from '@reactcraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { ok, type Result } from '../shared/result.ts';

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
