import {
  err,
  ok,
  type Result,
  THEME_VAR_PREFIX,
  type ThemeEdit,
  type ThemeTokenKind,
} from '@reactcraft/shared';

const COLOR_HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const COLOR_FN_PREFIXES = [
  'rgb(',
  'rgba(',
  'hsl(',
  'hsla(',
  'oklch(',
  'oklab(',
  'color-mix(',
  'var(--',
];
const LENGTH_RE = /^\d+(\.\d+)?(px|rem|em)$/;
const LENGTH_FN_PREFIXES = ['calc(', 'var(--'];
const FONT_CHARS_RE = /^[a-zA-Z0-9\s,\-_'"()]+$/;

const CLASS_PREFIXES_BY_KIND: Readonly<Record<ThemeTokenKind, readonly string[]>> = {
  color: [
    'bg',
    'text',
    'border',
    'border-t',
    'border-r',
    'border-b',
    'border-l',
    'border-x',
    'border-y',
    'ring',
    'ring-offset',
    'fill',
    'stroke',
    'from',
    'via',
    'to',
    'outline',
    'decoration',
    'accent',
    'caret',
    'divide',
    'placeholder',
    'shadow',
  ],
  font: ['font'],
  fontSize: ['text'],
  radius: [
    'rounded',
    'rounded-t',
    'rounded-r',
    'rounded-b',
    'rounded-l',
    'rounded-tl',
    'rounded-tr',
    'rounded-br',
    'rounded-bl',
    'rounded-s',
    'rounded-e',
  ],
  shadow: ['shadow'],
};

function hasBalancedParens(value: string): boolean {
  let depth = 0;
  for (const ch of value) {
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

function isOuterFunctionCall(value: string, prefixes: readonly string[]): boolean {
  const lower = value.toLowerCase();
  const matchedPrefix = prefixes.find((prefix) => lower.startsWith(prefix));
  if (matchedPrefix === undefined || !value.endsWith(')')) return false;
  const openIndex = matchedPrefix.indexOf('(');
  const inner = value.slice(openIndex + 1, -1).trim();
  if (inner.length === 0) return false;
  let depth = 0;
  for (let i = openIndex; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i === value.length - 1;
    }
  }
  return false;
}

function isValidFontValue(value: string): boolean {
  if (!FONT_CHARS_RE.test(value)) return false;
  const singleQuotes = (value.match(/'/g) ?? []).length;
  const doubleQuotes = (value.match(/"/g) ?? []).length;
  if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) return false;
  if (value.includes('(') || value.includes(')')) {
    return isOuterFunctionCall(value, ['var(--']);
  }
  return true;
}

export function isValidThemeValue(kind: ThemeTokenKind, value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 300) return false;
  if (/[;{}\r\n]/.test(trimmed) || trimmed.includes('/*') || trimmed.includes('*/')) {
    return false;
  }
  if (!hasBalancedParens(trimmed)) return false;

  switch (kind) {
    case 'color':
      return COLOR_HEX_RE.test(trimmed) || isOuterFunctionCall(trimmed, COLOR_FN_PREFIXES);
    case 'fontSize':
    case 'radius':
      return (
        trimmed === '0' ||
        LENGTH_RE.test(trimmed) ||
        isOuterFunctionCall(trimmed, LENGTH_FN_PREFIXES)
      );
    case 'font':
      return isValidFontValue(trimmed);
    case 'shadow':
      return true;
  }
}

interface ThemeBlockSpan {
  readonly openBraceIndex: number;
  readonly closeBraceIndex: number;
}

interface DeclarationSpan {
  readonly varStart: number;
  readonly colonIndex: number;
  readonly semicolonIndex: number;
}

function maskComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\r\n]/g, ' '));
}

function findThemeBlocks(maskedCss: string): ThemeBlockSpan[] {
  const blocks: ThemeBlockSpan[] = [];
  const blockRegex = /@theme\s*(?:inline)?\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | undefined = blockRegex.exec(maskedCss) ?? undefined;
  while (match !== undefined) {
    const full = match[0];
    const openOffset = full.indexOf('{');
    blocks.push({
      openBraceIndex: match.index + openOffset,
      closeBraceIndex: match.index + full.length - 1,
    });
    match = blockRegex.exec(maskedCss) ?? undefined;
  }
  return blocks;
}

function findDeclarationInBlocks(
  maskedCss: string,
  blocks: readonly ThemeBlockSpan[],
  targetVar: string,
): DeclarationSpan | undefined {
  const declRegex = /(--[a-zA-Z0-9-]+)\s*:([^;{}]*);/g;
  for (const block of blocks) {
    const bodyStart = block.openBraceIndex + 1;
    const body = maskedCss.slice(bodyStart, block.closeBraceIndex);
    declRegex.lastIndex = 0;
    let match: RegExpExecArray | undefined = declRegex.exec(body) ?? undefined;
    while (match !== undefined) {
      if (match[1] === targetVar) {
        const varStart = bodyStart + match.index;
        const colonOffset = match[0].indexOf(':');
        return {
          varStart,
          colonIndex: varStart + colonOffset,
          semicolonIndex: varStart + match[0].length - 1,
        };
      }
      match = declRegex.exec(body) ?? undefined;
    }
  }
  return undefined;
}

function detectBlockIndent(css: string, block: ThemeBlockSpan): string {
  const body = css.slice(block.openBraceIndex + 1, block.closeBraceIndex);
  const indentRegex = /^([ \t]*)--[a-zA-Z0-9-]+\s*:/gm;
  let lastIndent = '  ';
  let match: RegExpExecArray | undefined = indentRegex.exec(body) ?? undefined;
  while (match !== undefined) {
    lastIndent = match[1] ?? '  ';
    match = indentRegex.exec(body) ?? undefined;
  }
  return lastIndent;
}

function insertTokenIntoCss(
  css: string,
  maskedCss: string,
  blocks: readonly ThemeBlockSpan[],
  targetVar: string,
  value: string,
): string {
  const nl = css.includes('\r\n') ? '\r\n' : '\n';
  const firstBlock = blocks[0];
  if (firstBlock !== undefined) {
    const indent = detectBlockIndent(css, firstBlock);
    const body = css.slice(firstBlock.openBraceIndex + 1, firstBlock.closeBraceIndex);
    if (!body.includes('\n')) {
      const beforeClose = css.slice(0, firstBlock.closeBraceIndex).replace(/[ \t]+$/, '');
      const afterClose = css.slice(firstBlock.closeBraceIndex);
      return `${beforeClose}${nl}${indent}${targetVar}: ${value};${nl}${afterClose}`;
    }
    let insertPos = firstBlock.closeBraceIndex;
    while (insertPos > firstBlock.openBraceIndex + 1) {
      const prev = css[insertPos - 1];
      if (prev === ' ' || prev === '\t') insertPos -= 1;
      else break;
    }
    const line = `${indent}${targetVar}: ${value};${nl}`;
    return `${css.slice(0, insertPos)}${line}${css.slice(insertPos)}`;
  }

  const importRegex = /@import\s+["']tailwindcss["']\s*;[^\r\n]*(\r?\n)?/;
  const importMatch = importRegex.exec(maskedCss) ?? undefined;
  if (importMatch !== undefined) {
    const insertPos = importMatch.index + importMatch[0].length;
    const hasTrailingNewline = importMatch[1] !== undefined && importMatch[1].length > 0;
    const prefixNl = hasTrailingNewline ? nl : `${nl}${nl}`;
    const blockText = `${prefixNl}@theme {${nl}  ${targetVar}: ${value};${nl}}${nl}`;
    return `${css.slice(0, insertPos)}${blockText}${css.slice(insertPos)}`;
  }

  const needsLeadingNl = css.length > 0 && !css.endsWith('\n');
  const blockText = `${needsLeadingNl ? nl : ''}@theme {${nl}  ${targetVar}: ${value};${nl}}${nl}`;
  return `${css}${blockText}`;
}

function removeDeclarationLine(css: string, maskedCss: string, decl: DeclarationSpan): string {
  let lineStart = decl.varStart;
  while (lineStart > 0 && (css[lineStart - 1] === ' ' || css[lineStart - 1] === '\t')) {
    lineStart -= 1;
  }
  const atStartOfLine = lineStart === 0 || css[lineStart - 1] === '\n';

  let lineEnd = decl.semicolonIndex + 1;
  while (
    lineEnd < maskedCss.length &&
    (maskedCss[lineEnd] === ' ' || maskedCss[lineEnd] === '\t')
  ) {
    lineEnd += 1;
  }

  if (atStartOfLine) {
    if (maskedCss[lineEnd] === '\r' && maskedCss[lineEnd + 1] === '\n') {
      return `${css.slice(0, lineStart)}${css.slice(lineEnd + 2)}`;
    }
    if (maskedCss[lineEnd] === '\n') {
      return `${css.slice(0, lineStart)}${css.slice(lineEnd + 1)}`;
    }
  }

  return `${css.slice(0, lineStart)}${css.slice(decl.semicolonIndex + 1)}`;
}

export function applyThemeEdit(css: string, edit: ThemeEdit): Result<string> {
  if (edit.op !== 'remove' && !isValidThemeValue(edit.kind, edit.value)) {
    return err({ code: 'E016', params: { reason: 'invalidValue' } });
  }

  const targetVar = `${THEME_VAR_PREFIX[edit.kind]}${edit.name}`;
  const maskedCss = maskComments(css);
  const blocks = findThemeBlocks(maskedCss);
  const existing = findDeclarationInBlocks(maskedCss, blocks, targetVar);

  if (edit.op === 'set') {
    if (existing === undefined) {
      return err({ code: 'E016', params: { reason: 'tokenNotFound' } });
    }
    // Only the value changes: the author's spacing after ':' and before ';' stays as it was.
    const valueRegion = css.slice(existing.colonIndex + 1, existing.semicolonIndex);
    const lead = /^\s*/.exec(valueRegion)?.[0] ?? '';
    const trail = /\s*$/.exec(valueRegion)?.[0] ?? '';
    const head = css.slice(0, existing.colonIndex + 1);
    return ok(`${head}${lead}${edit.value.trim()}${trail}${css.slice(existing.semicolonIndex)}`);
  }

  if (edit.op === 'add') {
    if (existing !== undefined) {
      return err({ code: 'E016', params: { reason: 'tokenExists' } });
    }
    return ok(insertTokenIntoCss(css, maskedCss, blocks, targetVar, edit.value.trim()));
  }

  if (existing === undefined) {
    return err({ code: 'E016', params: { reason: 'tokenNotFound' } });
  }
  return ok(removeDeclarationLine(css, maskedCss, existing));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function countTokenUses(source: string, kind: ThemeTokenKind, name: string): number {
  const prefixes = CLASS_PREFIXES_BY_KIND[kind];
  const candidates = prefixes.map((prefix) => escapeRegExp(`${prefix}-${name}`));
  const pattern = new RegExp(
    `(?<=^|[\\s"'\`{:])!?(?:${candidates.join('|')})(?=$|[\\s"'\`}/])`,
    'g',
  );
  return (source.match(pattern) ?? []).length;
}
