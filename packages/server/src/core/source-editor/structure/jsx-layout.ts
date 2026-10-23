// Built-in layout of a one-line JSX snippet before it is inserted (SPEC-04 M-FM, R-FM-04).
import { asAstNode, type AstNode, parseJsxAst } from '../ast-helpers.ts';

const INDENT = '  ';
const WRAP_OPEN = '<>';

type Layout = { readonly src: string; readonly printWidth: number };

function rawChildren(node: AstNode): AstNode[] {
  const list = Array.isArray(node['children']) ? node['children'] : [];
  return list.flatMap((c) => asAstNode(c) ?? []);
}

function slice(layout: Layout, node: AstNode | undefined): string {
  return node === undefined ? '' : layout.src.slice(node.start ?? 0, node.end ?? 0);
}

function isBlankText(node: AstNode): boolean {
  return (
    node.type === 'JSXText' && !/\S/.test(typeof node['value'] === 'string' ? node['value'] : '')
  );
}

/**
 * Children can go one per line only when no text sits between them: in a one-line snippet a space
 * between two elements is rendered, and a line break would remove it.
 */
function canBreakChildren(children: readonly AstNode[]): boolean {
  const hasElement = children.some((c) => c.type === 'JSXElement' || c.type === 'JSXFragment');
  return hasElement && !children.some((c) => c.type === 'JSXText');
}

function openingParts(
  layout: Layout,
  node: AstNode,
): { name: string; attrs: string[] } | undefined {
  if (node.type === 'JSXFragment') return { name: '', attrs: [] };
  const opening = asAstNode(node['openingElement']);
  if (opening === undefined || opening['typeArguments'] || opening['typeParameters'])
    return undefined;
  const attrs = Array.isArray(opening['attributes']) ? opening['attributes'] : [];
  return {
    name: slice(layout, asAstNode(opening['name'])),
    attrs: attrs.map((a) => slice(layout, asAstNode(a))),
  };
}

function printOpening(
  layout: Layout,
  indent: string,
  name: string,
  attrs: readonly string[],
  close: '>' | ' />',
): string[] {
  const oneLine = `<${name}${attrs.map((a) => ` ${a}`).join('')}${close}`;
  if (attrs.length === 0 || indent.length + oneLine.length <= layout.printWidth) {
    return [indent + oneLine];
  }
  return [
    `${indent}<${name}`,
    ...attrs.map((a) => `${indent}${INDENT}${a}`),
    `${indent}${close.trim()}`,
  ];
}

function printNode(layout: Layout, node: AstNode, indent: string): string[] {
  if (node.type !== 'JSXElement' && node.type !== 'JSXFragment') {
    return [indent + slice(layout, node)];
  }
  const parts = openingParts(layout, node);
  if (parts === undefined) return [indent + slice(layout, node)];

  const children = rawChildren(node).filter((c) => !isBlankText(c));
  if (children.length === 0 && node.type === 'JSXElement') {
    return printOpening(layout, indent, parts.name, parts.attrs, ' />');
  }
  if (!canBreakChildren(rawChildren(node))) {
    const opening = printOpening(layout, indent, parts.name, parts.attrs, '>');
    if (opening.length > 1) {
      // Attributes on their own lines: a lone child may go on its own line too when no space at
      // its ends would be lost; anything else stays exactly as written.
      const only = rawChildren(node);
      const lone = only.length === 1 ? only[0] : undefined;
      const text = lone === undefined ? '' : slice(layout, lone);
      if (lone === undefined || text !== text.trim()) return [indent + slice(layout, node)];
      return [...opening, `${indent}${INDENT}${text}`, `${indent}</${parts.name}>`];
    }
    // Every child, spaces included, exactly as written: they are rendered.
    const all = rawChildren(node);
    const inner = layout.src.slice(all[0]?.start ?? 0, all.at(-1)?.end ?? 0);
    return [`${opening[0] ?? ''}${inner}</${parts.name}>`];
  }
  return [
    ...printOpening(layout, indent, parts.name, parts.attrs, '>'),
    ...children.flatMap((c) => printNode(layout, c, indent + INDENT)),
    `${indent}</${parts.name}>`,
  ];
}

/**
 * Lays a one-line JSX snippet out one child element per line, two spaces per level; the caller
 * re-indents it to the file (R-SE-09). Multi-line snippets are already laid out by whoever wrote
 * them and come back unchanged, as does anything that does not parse or holds loose text.
 */
export function layoutJsxSnippet(jsx: string, printWidth: number): string {
  const trimmed = jsx.trim();
  if (trimmed.includes('\n')) return jsx;
  const src = `${WRAP_OPEN}${trimmed}</>`;
  let root: AstNode | undefined;
  try {
    const program = asAstNode(parseJsxAst(src)['program']);
    const body = Array.isArray(program?.['body']) ? program['body'] : [];
    root = asAstNode(asAstNode(body[0])?.['expression']);
  } catch {
    return jsx;
  }
  if (root?.type !== 'JSXFragment') return jsx;
  const top = rawChildren(root);
  if (top.some((c) => c.type === 'JSXText' && !isBlankText(c))) return jsx;
  const layout: Layout = { src, printWidth };
  return top
    .filter((c) => !isBlankText(c))
    .flatMap((c) => printNode(layout, c, ''))
    .join('\n');
}
