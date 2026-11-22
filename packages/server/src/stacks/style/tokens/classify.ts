// Classify CSS/Sass/Less variables into brand theme token kinds (SPEC-04 R-ST-11).
import { THEME_TOKEN_NAME, type ThemeTokenKind } from '@kumicraft/shared';

const COLOR_HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const COLOR_FN_PREFIXES = [
  'rgb(',
  'rgba(',
  'hsl(',
  'hsla(',
  'oklch(',
  'oklab(',
  'lab(',
  'lch(',
  'color-mix(',
];
const LENGTH_RE = /^(\d+(\.\d+)?(px|rem|em|%|vh|vw|pt|cm|mm|in|pc|ch|ex|vmin|vmax)|0)$/i;

export type ClassifiedToken = {
  readonly kind: ThemeTokenKind;
  readonly name: string;
};

function isColorValue(val: string): boolean {
  const trimmed = val.trim();
  if (COLOR_HEX_RE.test(trimmed)) return true;
  const lower = trimmed.toLowerCase();
  return COLOR_FN_PREFIXES.some((p) => lower.startsWith(p) && lower.endsWith(')'));
}

function isLengthValue(val: string): boolean {
  const trimmed = val.trim();
  if (LENGTH_RE.test(trimmed)) return true;
  const lower = trimmed.toLowerCase();
  return (lower.startsWith('calc(') || lower.startsWith('var(--')) && lower.endsWith(')');
}

/**
 * Classifies a variable name (without leading `--`, `$`, `@`) and its value into a theme token kind
 * and canonical name matching `THEME_TOKEN_NAME`.
 */
export function classifyVariable(rawName: string, rawValue: string): ClassifiedToken | undefined {
  const name = rawName.replace(/^(--|\$|@)/, '').trim();
  const val = rawValue.trim();

  let kind: ThemeTokenKind | undefined;
  let cleanName = name;

  if (name.includes('shadow')) {
    kind = 'shadow';
    cleanName = name.replace(/^shadow-/, '');
  } else if (name.includes('radius') || name.includes('rounded')) {
    kind = 'radius';
    cleanName = name.replace(/^radius-/, '');
  } else if (
    (name.includes('font-size') || name.includes('text-size') || name.startsWith('fs-')) &&
    isLengthValue(val)
  ) {
    kind = 'fontSize';
    cleanName = name.replace(/^(font-size-|text-|fs-)/, '');
  } else if (name.includes('font') || name.includes('family')) {
    kind = 'font';
    cleanName = name.replace(/^font-/, '');
  } else if (isColorValue(val)) {
    kind = 'color';
    cleanName = name.replace(/^color-/, '');
  }

  if (kind === undefined) return undefined;
  if (!THEME_TOKEN_NAME.test(cleanName)) return undefined;

  return { kind, name: cleanName };
}
