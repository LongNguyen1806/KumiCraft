// Transform JSX to attach data-rc-loc coordinates (SPEC-04 M-BR, R-BR-01..03, V-100..102).
import { isAbsolute, normalize, relative } from 'node:path';

import { parse } from '@babel/parser';
import { isInSourceDir } from '@kumicraft/shared';
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

  return isInSourceDir(rel, options.sourceDir);
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

/**
 * KumiCraft kit components that render one element of the page and pass their props to it
 * (QA K9.8-1): tagged like HTML elements, so the user can select them on the Canvas and edit their
 * classes, for example the "Selected" look of a choice.
 */
const KIT_ELEMENT_COMPONENTS: ReadonlySet<string> = new Set(['SelectItem', 'LoadingButton']);

function isHtmlOrSvgTag(openingElement: Record<string, unknown>): boolean {
  const nameNode = openingElement['name'] as Record<string, unknown> | undefined;
  if (!nameNode || nameNode['type'] !== 'JSXIdentifier') return false;
  const tagName = typeof nameNode['name'] === 'string' ? nameNode['name'] : '';
  return /^[a-z]/.test(tagName) || KIT_ELEMENT_COMPONENTS.has(tagName);
}

/** React's own tags: they take no other props (a Fragment warns about any), so they get no mark. */
const REACT_BUILTIN_TAGS: ReadonlySet<string> = new Set([
  'Fragment',
  'StrictMode',
  'Suspense',
  'Profiler',
  'Activity',
]);

/**
 * A component used in the page (`<Card …>`, `<Reveal …>`): it renders no element of its own, so
 * the line that placed it rides along as a prop, `data-rc-use`, which the Canvas reads back from
 * React to select that use instead of the inside of the component's file. Only plain names: a
 * `<Ctx.Provider>` or `<motion.div>` is left alone.
 */
function isComponentTag(openingElement: Record<string, unknown>): boolean {
  const nameNode = openingElement['name'] as Record<string, unknown> | undefined;
  if (!nameNode || nameNode['type'] !== 'JSXIdentifier') return false;
  const tagName = typeof nameNode['name'] === 'string' ? nameNode['name'] : '';
  return (
    /^[A-Z]/.test(tagName) &&
    !KIT_ELEMENT_COMPONENTS.has(tagName) &&
    !REACT_BUILTIN_TAGS.has(tagName)
  );
}

function hasAttribute(openingElement: Record<string, unknown>, attrName: string): boolean {
  const attributes = openingElement['attributes'];
  if (!Array.isArray(attributes)) return false;
  return attributes.some((attr: unknown) => {
    if (!attr || typeof attr !== 'object') return false;
    const a = attr as Record<string, unknown>;
    if (a['type'] !== 'JSXAttribute') return false;
    const name = a['name'] as Record<string, unknown> | undefined;
    return name?.['name'] === attrName;
  });
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
    const component = isComponentTag(node);
    if (component ? hasAttribute(node, 'data-rc-use') : !isHtmlOrSvgTag(node)) return;
    if (!component && hasRcLocAttribute(node)) return;

    const loc = node['loc'] as { start: { line: number; column: number } } | undefined;
    const nameNode = node['name'] as { end: number } | undefined;
    if (!loc || !nameNode) return;

    const line = loc.start.line;
    let column = loc.start.column + 1;
    if (hasBom && line === 1) {
      column -= 1;
    }

    const locString = `${relPath}:${String(line)}:${String(column)}`;
    // A use also names its tag as written (`RelativeCard` for `Card as RelativeCard`).
    const tagName = String((node['name'] as Record<string, unknown>)['name']);
    const mark = component ? `data-rc-use="${locString}|${tagName}"` : `data-rc-loc="${locString}"`;
    s.appendLeft(nameNode.end, ` ${mark}`);
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
