// AST traversal and JSX locator utilities (R-SE-02, R-SE-09, R-SE-10, R-SE-14, R-SE-15).
import { parse } from '@babel/parser';

export type AstPosition = {
  readonly line: number;
  readonly column: number;
};

export type AstLoc = {
  readonly start?: AstPosition | undefined;
  readonly end?: AstPosition | undefined;
};

export type AstNode = {
  readonly type: string;
  readonly start?: number | undefined;
  readonly end?: number | undefined;
  readonly loc?: AstLoc | undefined;
  readonly [key: string]: unknown;
};

export function isAstNode(val: unknown): val is AstNode {
  return (
    typeof val === 'object' &&
    Boolean(val) &&
    'type' in (val as object) &&
    typeof (val as Record<string, unknown>)['type'] === 'string'
  );
}

export function asAstNode(val: unknown): AstNode | undefined {
  return isAstNode(val) ? val : undefined;
}

export type DetectedFormat = {
  readonly hasBom: boolean;
  readonly newline: '\r\n' | '\n';
};

/**
 * Detects BOM and predominant newline style in source code (R-SE-10).
 */
export function detectFormat(raw: string): DetectedFormat {
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const content = hasBom ? raw.slice(1) : raw;

  const crlfCount = (content.match(/\r\n/g) ?? []).length;
  const lfCount = (content.match(/[^\r]\n/g) ?? []).length;

  return {
    hasBom,
    newline: crlfCount > lfCount ? '\r\n' : '\n',
  };
}

export type IndentInfo = {
  readonly useTab: boolean;
  readonly step: number;
  readonly openingIndent: string;
};

/**
 * Calculates indentation style and step for the element (R-SE-09).
 */
export function detectIndentation(code: string, targetLine: number): IndentInfo {
  const lines = code.split(/\r?\n/);
  const targetLineText = lines[targetLine - 1] ?? '';

  const matchIndent = /^([ \t]*)/.exec(targetLineText);
  const openingIndent = matchIndent?.[1] ?? '';
  const useTab = openingIndent.startsWith('\t');

  if (useTab) {
    return { useTab: true, step: 1, openingIndent };
  }

  // Find minimum non-zero indentation step across file lines, default 2
  let minStep = 2;
  for (const line of lines) {
    const spaceMatch = line.match(/^( +)[^ ]/);
    if (spaceMatch) {
      const len = spaceMatch[1]?.length ?? 0;
      if (len > 0 && len % 2 === 0) {
        minStep = Math.min(minStep, 2);
      }
    }
  }

  return { useTab: false, step: minStep, openingIndent };
}

/**
 * Parses code into a Babel AST with JSX and TypeScript support.
 */
export function parseJsxAst(code: string): AstNode {
  const parsed = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
    tokens: true,
  });
  const node = asAstNode(parsed);
  if (!node) {
    throw new Error('Failed to parse AST node');
  }
  return node;
}

/**
 * Extracts tag name from a JSX Opening Element.
 */
export function getJsxTagName(openingEl: AstNode): string | undefined {
  const nameNode = asAstNode(openingEl['name']);
  if (!nameNode) return undefined;
  if (nameNode.type === 'JSXIdentifier' && typeof nameNode['name'] === 'string') {
    return nameNode['name'];
  }
  if (nameNode.type === 'JSXMemberExpression') {
    const obj = asAstNode(nameNode['object']);
    const prop = asAstNode(nameNode['property']);
    if (obj && prop && typeof obj['name'] === 'string' && typeof prop['name'] === 'string') {
      return `${obj['name']}.${prop['name']}`;
    }
  }
  return undefined;
}
