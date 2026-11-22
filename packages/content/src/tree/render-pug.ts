// Renders the neutral tree as Pug (Express + Pug projects). Attributes and text are written already
// escaped (`!=`, `|`) the way React escapes them, so Pug outputs the same HTML as renderHtml.
import { contentOf, escapeHtml, htmlAttrs, VOID_TAGS } from './render-html.ts';
import type { TreeElement, TreeNode } from './tree.ts';

/** Text after `|` is not escaped by Pug; only its interpolation markers must be. */
function pugText(value: string): string {
  return escapeHtml(value).replaceAll('#{', '\\#{').replaceAll('#[', '\\#[');
}

function pugAttrs(el: TreeElement): string {
  // The value is React-escaped already: `!=` keeps Pug from escaping it twice.
  const parts = htmlAttrs(el).map((html) => {
    const eq = html.indexOf('=');
    return `${html.slice(0, eq)}!=${JSON.stringify(html.slice(eq + 2, -1))}`;
  });
  return parts.length === 0 ? '' : `(${parts.join(', ')})`;
}

function renderElement(el: TreeElement, indent: string): string {
  const head = `${indent}${el.tag}${pugAttrs(el)}`;
  if (VOID_TAGS.has(el.tag)) return `${head}/`;
  const content = contentOf(el);
  if (content.length === 0) return head;
  const inner = content
    .map((c) =>
      c.kind === 'text' ? `${indent}  | ${pugText(c.value)}` : renderElement(c, `${indent}  `),
    )
    .join('\n');
  return `${head}\n${inner}`;
}

export function renderPug(nodes: readonly TreeNode[]): string {
  return nodes
    .map((n) => (n.kind === 'text' ? `| ${pugText(n.value)}` : renderElement(n, '')))
    .join('\n');
}
