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

  // Smallest non-zero indentation in spaces across the file, default 2. Lines of a block comment
  // (` * text`) sit one space in and say nothing about the code's step.
  let minStep: number | undefined;
  for (const line of lines) {
    const spaceMatch = /^( +)([^ ])/.exec(line);
    if (!spaceMatch || spaceMatch[2] === '*') continue;
    const len = spaceMatch[1]?.length ?? 0;
    minStep = minStep === undefined ? len : Math.min(minStep, len);
  }

  return { useTab: false, step: minStep ?? 2, openingIndent };
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

/** The JSX element whose opening tag starts at `line`:`column` (1-based column, R-SE-02). */
export function findNodeAt(ast: AstNode, line: number, column: number): AstNode | undefined {
  let targetNode: AstNode | undefined;

  function walk(node: unknown) {
    const astN = asAstNode(node);
    if (!astN || targetNode) return;

    if (astN.type === 'JSXElement') {
      const opening = asAstNode(astN['openingElement']);
      const start = opening?.loc?.start;
      if (start && start.line === line && start.column + 1 === column) {
        targetNode = astN;
        return;
      }
    }

    for (const key of Object.keys(astN)) {
      if (key === 'loc' || key === 'comments' || key === 'tokens') continue;
      const child = astN[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item);
      } else if (child !== undefined && typeof child === 'object') {
        walk(child);
      }
    }
  }

  walk(ast['program']);
  return targetNode;
}

/** Where a new import line goes: after the last import, or at the top. */
export function findImportInsertPosition(ast: AstNode, code: string): number {
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  let lastImportEnd = -1;

  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type === 'ImportDeclaration' && stmt.end !== undefined) {
      if (stmt.end > lastImportEnd) lastImportEnd = stmt.end;
    }
  }

  if (lastImportEnd !== -1) {
    let pos = lastImportEnd;
    while (pos < code.length && code[pos] !== '\n') pos++;
    return pos < code.length && code[pos] === '\n' ? pos + 1 : lastImportEnd;
  }

  return 0;
}
