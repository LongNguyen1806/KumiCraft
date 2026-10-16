// Source editor AST caching, lookup and element building helpers (SPEC-04 section 6).
import { createHash } from 'node:crypto';
import * as path from 'node:path';

import type { ElementSource, ElementText } from '@reactcraft/shared';
import { err, ok, parseLocString, relPathProblem, type Result } from '@reactcraft/shared';

import type { AstNode } from './ast-helpers.ts';
import { asAstNode, getJsxTagName, parseJsxAst } from './ast-helpers.ts';
import { readClassName, readEditableAttributes } from './attribute-reader.ts';
import { checkInLoop, findEnclosingComponent } from './component-analyzer.ts';
import { decodeHtmlEntities, normalizeJsxWhitespace } from './text-reader.ts';

type AstCacheEntry = {
  readonly hash: string;
  readonly ast: AstNode;
  readonly code: string;
};

const astCache = new Map<string, AstCacheEntry>();

export function getCachedAst(fileKey: string, code: string, hash: string): AstNode {
  const cached = astCache.get(fileKey);
  if (cached && cached.hash === hash) {
    return cached.ast;
  }
  const ast = parseJsxAst(code);
  if (astCache.size >= 50) {
    const firstKey = astCache.keys().next().value;
    if (firstKey !== undefined) astCache.delete(firstKey);
  }
  astCache.set(fileKey, { hash, ast, code });
  return ast;
}

export function cacheAst(fileKey: string, code: string, hash: string, ast: AstNode): void {
  astCache.set(fileKey, { hash, ast, code });
}

export function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

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

export function parseText(children: readonly unknown[]): ElementText {
  if (children.length === 0) return { kind: 'static', value: '' };

  const astChildren = children.map(asAstNode).filter((c): c is AstNode => c !== undefined);
  const onlyText =
    astChildren.length === children.length && astChildren.every((c) => c.type === 'JSXText');
  if (onlyText) {
    const rawCombined = astChildren
      .map((c) => (typeof c['value'] === 'string' ? c['value'] : ''))
      .join('');
    const normalized = normalizeJsxWhitespace(rawCombined);
    return { kind: 'static', value: decodeHtmlEntities(normalized) };
  }

  if (astChildren.length === 1 && astChildren[0]?.type === 'JSXExpressionContainer') {
    const expr = asAstNode(astChildren[0]['expression']);
    return { kind: 'expression', code: typeof expr?.['name'] === 'string' ? expr['name'] : '' };
  }

  return { kind: 'mixed' as const };
}

export function buildElementSource(
  loc: string,
  targetNode: AstNode,
  code: string,
  fileHash: string,
  ast: AstNode,
  readonlyReason?: 'outsideSource' | 'tooLarge',
): ElementSource {
  const opening = asAstNode(targetNode['openingElement']) ?? { type: 'JSXOpeningElement' };
  const tag = getJsxTagName(opening) ?? 'div';
  const isSelfClosing = Boolean(opening['selfClosing']);

  const rawAttrs = Array.isArray(opening['attributes']) ? opening['attributes'] : [];
  const rawChildren = Array.isArray(targetNode['children']) ? targetNode['children'] : [];

  const className = readClassName(rawAttrs, code);
  const text: ElementText = isSelfClosing ? { kind: 'selfClosing' } : parseText(rawChildren);
  const attributes = readEditableAttributes(rawAttrs, code);
  const componentName = findEnclosingComponent(ast, targetNode);
  const inLoop = checkInLoop(ast, targetNode);

  return {
    loc,
    tag,
    fileHash,
    ...(readonlyReason !== undefined ? { readonly: readonlyReason } : {}),
    className,
    text,
    attributes,
    ...(componentName !== undefined ? { component: { name: componentName, usages: 1 } } : {}),
    inLoop,
  };
}

export type FileValidation = {
  readonly rel: string;
  readonly line: number;
  readonly column: number;
};

export function validateLocAndExt(
  loc: string,
  sourceDir: string,
  sourceExtensions: readonly string[],
): Result<FileValidation> {
  const parsed = parseLocString(loc);
  if (!parsed) return err({ code: 'E016', params: { loc } });

  const { file, line, column } = parsed;
  const relErr = relPathProblem(file);
  if (relErr !== undefined) return err({ code: 'E016', params: { file, reason: relErr } });

  const ext = path.extname(file);
  if (!sourceExtensions.includes(ext)) {
    return err({ code: 'E023', params: { file, reason: 'notJsxFile' } });
  }

  const normalizedSourceDir = sourceDir.replaceAll('\\', '/').replace(/\/+$/, '');
  if (!file.startsWith(`${normalizedSourceDir}/`) || file.includes('node_modules/')) {
    return err({ code: 'E023', params: { file, reason: 'outsideSource' } });
  }

  return ok({ rel: file, line, column });
}
