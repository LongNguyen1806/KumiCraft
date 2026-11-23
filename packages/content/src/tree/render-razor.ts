// A block as Razor markup (.cshtml, 03c section 3.3): the HTML of `renderHtml`, with every `@`
// written `@@` (Razor reads a lone `@` as C#) and laid out on lines. A line break is added only
// between elements whose parent holds elements alone and is not inline, so the page looks the same.
import { contentOf, htmlAttrs, renderHtml, VOID_TAGS } from './render-html.ts';
import type { TreeElement, TreeNode } from './tree.ts';

/** Elements whose children flow as text: a line break between them would show as a space. */
const INLINE = new Set([
  'a',
  'abbr',
  'b',
  'button',
  'code',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'label',
  'p',
  'small',
  'span',
  'strong',
  'svg',
  'textarea',
]);

const razorAt = (html: string): string => html.replaceAll('@', '@@');

function openTag(el: TreeElement): string {
  const attrs = htmlAttrs(el)
    .map((a) => ` ${a}`)
    .join('');
  return `<${el.tag}${attrs}>`;
}

function laidOut(el: TreeElement): boolean {
  const children = contentOf(el);
  return (
    !INLINE.has(el.tag) &&
    !VOID_TAGS.has(el.tag) &&
    children.length > 0 &&
    children.every((c) => c.kind === 'element')
  );
}

function renderNode(node: TreeNode, indent: string, unit: string, newline: string): string {
  if (node.kind === 'text' || !laidOut(node)) return razorAt(renderHtml([node]));
  const inner = indent + unit;
  const children = contentOf(node)
    .map((child) => newline + inner + renderNode(child, inner, unit, newline))
    .join('');
  return `${razorAt(openTag(node))}${children}${newline}${indent}</${node.tag}>`;
}

/**
 * The nodes as Razor markup, each top-level node on its own line. `indent` is the indentation of
 * the place they go (the first line is not indented: it continues the current line).
 */
export function renderRazor(
  nodes: readonly TreeNode[],
  indent = '',
  unit = '    ',
  newline = '\n',
): string {
  return nodes.map((node) => renderNode(node, indent, unit, newline)).join(newline + indent);
}
