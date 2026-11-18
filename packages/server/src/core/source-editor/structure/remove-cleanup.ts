// What a removal takes along (the owner's report of 2026-11-16): the placing `<div>` around a
// component in a free frame, a `<Reveal>` around the element alone, and the imports only the
// removed code used. A name still read anywhere else in the file keeps its import.
import { asAstNode, type AstNode } from '../ast-helpers.ts';
import { placeWrapperChild } from './place-wrapper.ts';
import { lineStartOf, type ResolvedElement } from './structure-ops.ts';
import type { TextEdit } from './text-edits.ts';

type Range = { readonly start: number; readonly end: number };

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

function walk(node: unknown, visit: (n: AstNode, parent: AstNode | undefined) => void): void {
  const stack: { node: unknown; parent: AstNode | undefined }[] = [{ node, parent: undefined }];
  while (stack.length > 0) {
    const top = stack.pop();
    if (top === undefined) break;
    if (Array.isArray(top.node)) {
      for (const item of top.node) stack.push({ node: item, parent: top.parent });
      continue;
    }
    const n = asAstNode(top.node);
    if (n === undefined) continue;
    visit(n, top.parent);
    for (const key of Object.keys(n)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
      stack.push({ node: n[key], parent: n });
    }
  }
}

/** The element a `<Reveal>` holds when it holds that one element and nothing else. */
function revealChild(parent: AstNode): unknown {
  const opening = asAstNode(parent['openingElement']);
  const name = asAstNode(opening?.['name']);
  if (name?.type !== 'JSXIdentifier' || name['name'] !== 'Reveal') return undefined;
  const children = Array.isArray(parent['children']) ? parent['children'] : [];
  const kept = children.filter((c) => {
    const n = asAstNode(c);
    return !(n?.type === 'JSXText' && text(n['value']).trim() === '');
  });
  return kept.length === 1 ? kept[0] : undefined;
}

function parentOf(ast: AstNode, node: AstNode): AstNode | undefined {
  let parent: AstNode | undefined;
  walk(ast, (n, p) => {
    if (n === node && p?.type === 'JSXElement') parent = p;
  });
  return parent;
}

/**
 * The element itself, or the wrapper that exists only for it: the placing `<div>` it is alone in,
 * the `<Reveal>` that only shows it in (the owner's report, 2026-11-18). An empty wrapper left
 * behind is a type error (`children` is required) and shows nothing.
 */
export function widenToPlaceWrapper(
  ast: AstNode,
  code: string,
  el: ResolvedElement,
): ResolvedElement {
  let current = el;
  for (;;) {
    const parent = parentOf(ast, current.node);
    if (parent === undefined) return current;
    const onlyFor =
      placeWrapperChild(parent, code) === current.node || revealChild(parent) === current.node;
    const opening = asAstNode(parent['openingElement']);
    if (
      !onlyFor ||
      opening === undefined ||
      parent.start === undefined ||
      parent.end === undefined
    ) {
      return current;
    }
    current = {
      ...current,
      node: parent,
      opening,
      start: parent.start,
      end: parent.end,
      line: parent.loc?.start?.line ?? current.line,
    };
  }
}

/** Where each name is read outside the imports: identifiers, JSX tag names, type names. */
function readsByName(ast: AstNode): Map<string, number[]> {
  const reads = new Map<string, number[]>();
  walk(asAstNode(ast['program'])?.['body'], (n, parent) => {
    if (n.type !== 'Identifier' && n.type !== 'JSXIdentifier') return;
    if (parent?.type === 'ImportSpecifier' || parent?.type === 'ImportDefaultSpecifier') return;
    if (parent?.type === 'ImportNamespaceSpecifier' || parent?.type === 'JSXAttribute') return;
    const isMember = parent?.type === 'MemberExpression' || parent?.type === 'JSXMemberExpression';
    if (isMember && parent['property'] === n && parent['computed'] !== true) return;
    if (parent?.type === 'ObjectProperty' && parent['key'] === n && parent['computed'] !== true) {
      return;
    }
    const name = n['name'];
    if (typeof name !== 'string' || n.start === undefined) return;
    reads.set(name, [...(reads.get(name) ?? []), n.start]);
  });
  return reads;
}

function specifierText(spec: AstNode): string {
  const local = text(asAstNode(spec['local'])?.['name']);
  if (spec.type === 'ImportDefaultSpecifier') return local;
  if (spec.type === 'ImportNamespaceSpecifier') return `* as ${local}`;
  const imported = asAstNode(spec['imported']);
  const name = text(imported?.['name']) || text(imported?.['value']) || local;
  const kind = spec['importKind'] === 'type' ? 'type ' : '';
  return `${kind}${name === local ? local : `${name} as ${local}`}`;
}

/** `import A, { B } from 'x';` written again with the specifiers left. */
function rewrittenImport(decl: AstNode, kept: readonly AstNode[], code: string): string {
  const source = asAstNode(decl['source']);
  const from = code.slice(source?.start ?? 0, source?.end ?? 0);
  const head = kept.filter((s) => s.type !== 'ImportSpecifier').map(specifierText);
  const named = kept.filter((s) => s.type === 'ImportSpecifier').map(specifierText);
  const parts = [...head, ...(named.length > 0 ? [`{ ${named.join(', ')} }`] : [])];
  const kind = decl['importKind'] === 'type' ? 'type ' : '';
  const semi = code.slice(0, decl.end).trimEnd().endsWith(';') ? ';' : '';
  return `import ${kind}${parts.join(', ')} from ${from}${semi}`;
}

function lineEndAfter(code: string, pos: number): number {
  const nl = code.indexOf('\n', pos);
  return nl === -1 ? code.length : nl + 1;
}

/** Edits that drop the imports only the removed ranges read. */
export function unusedImportEdits(
  ast: AstNode,
  code: string,
  removed: readonly Range[],
): TextEdit[] {
  const reads = readsByName(ast);
  const inRemoved = (pos: number) => removed.some((r) => r.start <= pos && pos < r.end);
  const goneOnlyWithRemoval = (spec: AstNode) => {
    const at = reads.get(text(asAstNode(spec['local'])?.['name'])) ?? [];
    return at.length > 0 && at.every(inRemoved);
  };
  const edits: TextEdit[] = [];
  const body = asAstNode(ast['program'])?.['body'];
  for (const raw of Array.isArray(body) ? body : []) {
    const decl = asAstNode(raw);
    if (decl?.type !== 'ImportDeclaration' || decl.start === undefined || decl.end === undefined) {
      continue;
    }
    const specs = (Array.isArray(decl['specifiers']) ? decl['specifiers'] : [])
      .map(asAstNode)
      .filter((s): s is AstNode => s !== undefined);
    const kept = specs.filter((s) => !goneOnlyWithRemoval(s));
    if (specs.length === 0 || kept.length === specs.length) continue;
    edits.push(
      kept.length === 0
        ? { start: lineStartOf(code, decl.start), end: lineEndAfter(code, decl.end), text: '' }
        : { start: decl.start, end: decl.end, text: rewrittenImport(decl, kept, code) },
    );
  }
  return edits;
}
