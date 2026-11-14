// Source editor AST caching, lookup and element building helpers (SPEC-04 section 6).
import { createHash } from 'node:crypto';
import * as path from 'node:path';

import type { ElementSource, ElementSourceText } from '@kumicraft/shared';
import { err, ok, parseLocString, relPathProblem, type Result } from '@kumicraft/shared';

import type { AstNode } from './ast-helpers.ts';
import { asAstNode, getJsxTagName, parseJsxAst } from './ast-helpers.ts';
import { readClassName, readEditableAttributes } from './attribute-reader.ts';
import { checkInLoop, findEnclosingComponent } from './component-analyzer.ts';
import { decodeHtmlEntities, normalizeJsxWhitespace } from './text-reader.ts';
import { extractMixedRuns } from './text-run-ops.ts';

type AstCacheEntry = {
  readonly hash: string;
  readonly ast: AstNode;
  readonly code: string;
};

/** R-SE-16: parsed files by (file, hash), least recently used out past AST_CACHE_SIZE files. */
export const AST_CACHE_SIZE = 50;
const astCache = new Map<string, AstCacheEntry>();

/** Puts `fileKey` last (most recent); the first key is then the least recently used. */
function remember(fileKey: string, entry: AstCacheEntry): void {
  astCache.delete(fileKey);
  astCache.set(fileKey, entry);
  while (astCache.size > AST_CACHE_SIZE) {
    const oldest = astCache.keys().next().value;
    if (oldest === undefined) break;
    astCache.delete(oldest);
  }
}

export function getCachedAst(fileKey: string, code: string, hash: string): AstNode {
  const cached = astCache.get(fileKey);
  if (cached && cached.hash === hash) {
    remember(fileKey, cached);
    return cached.ast;
  }
  const ast = parseJsxAst(code);
  remember(fileKey, { hash, ast, code });
  return ast;
}

export function cacheAst(fileKey: string, code: string, hash: string, ast: AstNode): void {
  remember(fileKey, { hash, ast, code });
}

/** Files in the cache, oldest first (tests). */
export function cachedAstFiles(): readonly string[] {
  return [...astCache.keys()];
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

export function parseText(children: readonly unknown[], code?: string): ElementSourceText {
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

  return { kind: 'mixed' as const, runs: extractMixedRuns(children, code) };
}

function readFreeFlag(attributes: readonly unknown[]): boolean {
  const freeAttr = attributes.map(asAstNode).find((a): a is AstNode => {
    if (!a || a.type !== 'JSXAttribute') return false;
    const nameNode = asAstNode(a['name']);
    return nameNode?.['name'] === 'data-rc-free';
  });
  if (!freeAttr) return false;
  const val = asAstNode(freeAttr['value']);
  if (!val) return true;
  if (val.type === 'StringLiteral') return val['value'] === 'true' || val['value'] === '';
  if (val.type === 'JSXExpressionContainer') {
    const expr = asAstNode(val['expression']);
    if (expr?.type === 'BooleanLiteral') return Boolean(expr['value']);
  }
  return true;
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
  const text: ElementSourceText = isSelfClosing
    ? { kind: 'selfClosing' }
    : parseText(rawChildren, code);
  const attributes = readEditableAttributes(rawAttrs, code);
  const componentName = findEnclosingComponent(ast, targetNode);
  const inLoop = checkInLoop(ast, targetNode);
  const free = readFreeFlag(rawAttrs);

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
    free,
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
