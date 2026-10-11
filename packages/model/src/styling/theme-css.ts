// Generate Tailwind v4 @theme CSS block from DesignTokens (SPEC-04.1 section 5.6).
import type { DesignTokens } from '../schema/document.schema.ts';

export type ThemeCssOptions = {
  readonly darkMode?: 'none' | 'media' | 'class';
};

function formatFontFamilies(families: readonly string[]): string {
  return families
    .map((name) => (name.includes(' ') && !name.startsWith('"') ? `"${name}"` : name))
    .join(', ');
}

function buildThemeVariables(tokens: DesignTokens): string[] {
  const lines: string[] = [];

  for (const [name, entry] of Object.entries(tokens.color)) {
    lines.push(`  --color-${name}: ${entry.value};`);
  }
  for (const [name, entry] of Object.entries(tokens.spacing)) {
    lines.push(`  --spacing-${name}: ${String(entry.value.px)}px;`);
  }
  for (const [name, entry] of Object.entries(tokens.radius)) {
    lines.push(`  --radius-${name}: ${String(entry.value.px)}px;`);
  }
  for (const [name, entry] of Object.entries(tokens.shadow)) {
    lines.push(`  --shadow-${name}: ${entry.value};`);
  }
  for (const [name, entry] of Object.entries(tokens.fontSize)) {
    lines.push(`  --text-${name}: ${String(entry.value.size.px)}px;`);
    if (entry.value.lineHeight !== undefined) {
      lines.push(`  --text-${name}--line-height: ${String(entry.value.lineHeight)};`);
    }
  }
  for (const [name, entry] of Object.entries(tokens.fontWeight)) {
    lines.push(`  --font-weight-${name}: ${String(entry.value)};`);
  }
  for (const [name, entry] of Object.entries(tokens.lineHeight)) {
    lines.push(`  --leading-${name}: ${String(entry.value)};`);
  }
  for (const [name, entry] of Object.entries(tokens.fontFamily)) {
    lines.push(`  --font-${name}: ${formatFontFamilies(entry.value)};`);
  }

  return lines;
}

function buildDarkModeBlock(tokens: DesignTokens, mode: 'class' | 'media'): string | undefined {
  const darkLines: string[] = [];
  for (const [name, entry] of Object.entries(tokens.color)) {
    if (entry.dark !== undefined) {
      darkLines.push(`  --color-${name}: ${entry.dark};`);
    }
  }
  if (darkLines.length === 0) return undefined;

  if (mode === 'class') {
    return [`.dark {`, ...darkLines, `}`].join('\n');
  }

  return [
    `@media (prefers-color-scheme: dark) {`,
    `  :root {`,
    ...darkLines.map((l) => `  ${l}`),
    `  }`,
    `}`,
  ].join('\n');
}

/**
 * Validates token names against R-SM-05: fontWeight and fontFamily must not overlap.
 */
export function validateTokenNameCollisions(tokens: DesignTokens): void {
  const weightNames = new Set(Object.keys(tokens.fontWeight));
  for (const family of Object.keys(tokens.fontFamily)) {
    if (weightNames.has(family)) {
      throw new Error(
        `R-SM-05: Token name "${family}" cannot be used in both fontWeight and fontFamily`,
      );
    }
  }
}

/**
 * Generates the Tailwind v4 `@theme` block and optional dark mode overrides (SPEC-04.1 section 5.6).
 */
export function generateThemeCss(tokens: DesignTokens, options?: ThemeCssOptions): string {
  validateTokenNameCollisions(tokens);

  const themeVars = buildThemeVariables(tokens);
  const sections = [`@theme {\n${themeVars.join('\n')}\n}`];

  const darkMode = options?.darkMode ?? 'class';
  if (darkMode !== 'none') {
    const darkBlock = buildDarkModeBlock(tokens, darkMode);
    if (darkBlock !== undefined) {
      sections.push(darkBlock);
    }
  }

  return sections.join('\n\n');
}
