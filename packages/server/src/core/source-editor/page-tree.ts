// Element tree of one JSX file for external AI agents (R-AG-19, round 7a). Every node carries the
// same `file:line:column` the Bridge puts on the element, so it works with the other source tools.
import {
  err,
  ok,
  PAGE_TREE_MAX_DEPTH,
  PAGE_TREE_MAX_NODES,
  type PageTree,
  type PageTreeNode,
  relPathProblem,
  type Result,
} from '@reactcraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import {
  asAstNode,
  type AstNode,
  detectFormat,
  getJsxTagName,
  parseJsxAst,
} from './ast-helpers.ts';
import { readClassName } from './attribute-reader.ts';
import { decodeHtmlEntities, normalizeJsxWhitespace } from './text-reader.ts';

const MAX_FILE_SIZE = 1024 * 1024; // same limit as the other source reads (R-SE-01)
const MAX_TEXT = 80;
const SKIPPED_KEYS = new Set(['loc', 'comments', 'tokens', 'leadingComments', 'trailingComments']);

export type PageTreeOptions = {
  readonly sourceDir: string;
  readonly sourceExtensions: readonly string[];
  readonly maxDepth?: number | undefined;
};

type Walk = {
  readonly file: string;
  readonly code: string;
  readonly maxDepth: number;
  count: number;
  truncated: boolean;
};

function isJsx(node: AstNode): boolean {
  return node.type === 'JSXElement' || node.type === 'JSXFragment';
}

/** JSX nodes reachable from `node` without passing through other JSX: the roots of that subtree. */
function collectJsxRoots(node: unknown, found: AstNode[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectJsxRoots(item, found);
    return;
  }
  const astNode = asAstNode(node);
  if (astNode === undefined) return;
  if (isJsx(astNode)) {
    found.push(astNode);
    return;
  }
  for (const [key, value] of Object.entries(astNode)) {
    if (!SKIPPED_KEYS.has(key) && typeof value === 'object') collectJsxRoots(value, found);
  }
}

function locOf(walk: Walk, node: AstNode): string {
  const opening = asAstNode(node['openingElement']) ?? asAstNode(node['openingFragment']) ?? node;
  const start = opening.loc?.start;
  const line = start?.line ?? 0;
  const column = (start?.column ?? 0) + 1;
  return `${walk.file}:${String(line)}:${String(column)}`;
}

function describe(node: AstNode): Pick<PageTreeNode, 'tag' | 'kind'> {
  const opening = asAstNode(node['openingElement']);
  if (node.type === 'JSXFragment' || opening === undefined)
    return { tag: 'Fragment', kind: 'fragment' };
  const tag = getJsxTagName(opening) ?? 'Unknown';
  if (tag === 'Fragment' || tag === 'React.Fragment') return { tag, kind: 'fragment' };
  return { tag, kind: /^[a-z]/.test(tag) ? 'element' : 'component' };
}

function staticText(children: readonly AstNode[]): string | undefined {
  const raw = children
    .filter((child) => child.type === 'JSXText')
    .map((child) => (typeof child['value'] === 'string' ? child['value'] : ''))
    .join(' ');
  const text = decodeHtmlEntities(normalizeJsxWhitespace(raw)).trim();
  return text === '' ? undefined : text.slice(0, MAX_TEXT);
}

function childJsx(children: readonly AstNode[]): AstNode[] {
  const found: AstNode[] = [];
  for (const child of children) {
    if (isJsx(child)) found.push(child);
    else if (child.type === 'JSXExpressionContainer') collectJsxRoots(child['expression'], found);
  }
  return found;
}

function buildNode(walk: Walk, node: AstNode, depth: number): PageTreeNode {
  walk.count += 1;
  const opening = asAstNode(node['openingElement']);
  const rawChildren = Array.isArray(node['children']) ? node['children'] : [];
  const children = rawChildren.map(asAstNode).filter((c): c is AstNode => c !== undefined);
  const attributes = Array.isArray(opening?.['attributes']) ? opening['attributes'] : [];
  const className = readClassName(attributes, walk.code);
  const text = staticText(children);
  const nested = childJsx(children);

  const built: PageTreeNode[] = [];
  if (depth >= walk.maxDepth) {
    if (nested.length > 0) walk.truncated = true;
  } else {
    for (const child of nested) {
      if (walk.count >= PAGE_TREE_MAX_NODES) {
        walk.truncated = true;
        break;
      }
      built.push(buildNode(walk, child, depth + 1));
    }
  }
  return {
    loc: locOf(walk, node),
    ...describe(node),
    ...(className.kind === 'static' ? { className: className.value } : {}),
    ...(text === undefined ? {} : { text }),
    children: built,
  };
}

function checkFile(file: string, options: PageTreeOptions): Result<string> {
  const problem = relPathProblem(file);
  if (problem !== undefined) return err({ code: 'E016', params: { file, reason: problem } });
  if (!options.sourceExtensions.some((ext) => file.endsWith(ext))) {
    return err({ code: 'E023', params: { file, reason: 'notJsxFile' } });
  }
  const sourceDir = options.sourceDir.replaceAll('\\', '/').replace(/\/+$/, '');
  if (!file.startsWith(`${sourceDir}/`) || file.includes('node_modules/')) {
    return err({ code: 'E023', params: { file, reason: 'outsideSource' } });
  }
  return ok(file);
}

function parseCode(code: string, file: string): Result<AstNode> {
  try {
    return ok(parseJsxAst(code));
  } catch {
    return err({ code: 'E016', params: { file, reason: 'syntax' } });
  }
}

export async function readPageTree(
  fs: FileSystemPort,
  projectRoot: string,
  file: string,
  options: PageTreeOptions,
): Promise<Result<PageTree>> {
  const checked = checkFile(file, options);
  if (!checked.ok) return checked;
  const read = await fs.readText(projectRoot, file, { maxBytes: MAX_FILE_SIZE, keepBom: true });
  if (!read.ok) return read;
  // Columns count from the text without its BOM, as the Bridge's do (R-BR-02).
  const code = detectFormat(read.value).hasBom ? read.value.slice(1) : read.value;
  const parsed = parseCode(code, file);
  if (!parsed.ok) return parsed;

  const maxDepth = Math.min(
    Math.max(options.maxDepth ?? PAGE_TREE_MAX_DEPTH, 1),
    PAGE_TREE_MAX_DEPTH,
  );
  const walk: Walk = { file, code, maxDepth, count: 0, truncated: false };
  const roots: AstNode[] = [];
  collectJsxRoots(parsed.value['program'], roots);
  const built: PageTreeNode[] = [];
  for (const root of roots) {
    if (walk.count >= PAGE_TREE_MAX_NODES) {
      walk.truncated = true;
      break;
    }
    built.push(buildNode(walk, root, 1));
  }
  return ok({ file, roots: built, truncated: walk.truncated });
}
