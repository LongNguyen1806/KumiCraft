// Transform JSX to attach data-rc-loc coordinates (SPEC-04 M-BR, R-BR-01..03, V-100..102).
import { isAbsolute, normalize, relative } from 'node:path';

import { parse } from '@babel/parser';
import MagicString from 'magic-string';

import { guardSelfRender } from './self-render-guard.ts';

export type TransformJsxOptions = {
  readonly rootDir: string;
  readonly sourceDir: string;
  readonly sourceExtensions?: readonly string[] | undefined;
};

export type TransformJsxResult = {
  readonly code: string;
  readonly map?: unknown;
};

const DEFAULT_EXTENSIONS = ['.jsx', '.tsx', '.js', '.ts'] as const;

function normalizeSeparators(p: string): string {
  return p.replace(/\\/g, '/');
}

export function shouldTransform(id: string, options: TransformJsxOptions): boolean {
  if (id.startsWith('\0') || id.includes('?')) return false;

  const normalizedId = normalizeSeparators(id);
  if (normalizedId.includes('/node_modules/')) return false;
  if (normalizedId.endsWith('.d.ts')) return false;

  const extensions = options.sourceExtensions ?? DEFAULT_EXTENSIONS;
  const hasExt = extensions.some((ext) => normalizedId.endsWith(ext));
  if (!hasExt) return false;

  const normalizedRoot = normalizeSeparators(normalize(options.rootDir));
  const rel = normalizeSeparators(relative(normalizedRoot, normalizedId));
  if (rel.startsWith('..') || isAbsolute(rel)) return false;

  const normalizedSrc = normalizeSeparators(options.sourceDir).replace(/^\/+|\/+$/g, '');
  return rel === normalizedSrc || rel.startsWith(`${normalizedSrc}/`);
}

function parseAst(code: string) {
  try {
    return parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      errorRecovery: false,
      ranges: true,
      tokens: true,
    });
  } catch {
    return undefined;
  }
}

function walkAst(node: unknown, visitor: (n: Record<string, unknown>) => void): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) {
      walkAst(child, visitor);
    }
    return;
  }
  const obj = node as Record<string, unknown>;
  visitor(obj);
  for (const key of Object.keys(obj)) {
    if (key === 'loc' || key === 'comments' || key === 'tokens') continue;
    walkAst(obj[key], visitor);
  }
}

function isHtmlOrSvgTag(openingElement: Record<string, unknown>): boolean {
  const nameNode = openingElement['name'] as Record<string, unknown> | undefined;
  if (!nameNode || nameNode['type'] !== 'JSXIdentifier') return false;
  const tagName = typeof nameNode['name'] === 'string' ? nameNode['name'] : '';
  return /^[a-z]/.test(tagName);
}

function hasRcLocAttribute(openingElement: Record<string, unknown>): boolean {
  const attributes = openingElement['attributes'];
  if (!Array.isArray(attributes)) return false;
  return attributes.some((attr: unknown) => {
    if (!attr || typeof attr !== 'object') return false;
    const a = attr as Record<string, unknown>;
    if (a['type'] !== 'JSXAttribute') return false;
    const name = a['name'] as Record<string, unknown> | undefined;
    return name?.['name'] === 'data-rc-loc';
  });
}

export function transformJsx(
  code: string,
  id: string,
  options: TransformJsxOptions,
): TransformJsxResult | undefined {
  if (!shouldTransform(id, options)) return undefined;

  const ast = parseAst(code);
  if (!ast) return undefined;

  const normalizedRoot = normalizeSeparators(normalize(options.rootDir));
  const relPath = normalizeSeparators(relative(normalizedRoot, normalizeSeparators(id)));
  const hasBom = code.charCodeAt(0) === 0xfeff;
  const s = new MagicString(code);

  walkAst(ast, (node) => {
    if (node['type'] !== 'JSXOpeningElement') return;
    if (!isHtmlOrSvgTag(node) || hasRcLocAttribute(node)) return;

    const loc = node['loc'] as { start: { line: number; column: number } } | undefined;
    const nameNode = node['name'] as { end: number } | undefined;
    if (!loc || !nameNode) return;

    const line = loc.start.line;
    let column = loc.start.column + 1;
    if (hasBom && line === 1) {
      column -= 1;
    }

    const locString = `${relPath}:${String(line)}:${String(column)}`;
    s.appendLeft(nameNode.end, ` data-rc-loc="${locString}"`);
  });
  guardSelfRender(ast.program, s, relPath);

  if (!s.hasChanged()) {
    return { code };
  }

  const map = s.generateMap({
    source: id,
    hires: true,
    includeContent: true,
  });

  return { code: s.toString(), map };
}
