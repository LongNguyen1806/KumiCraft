// Renders the neutral tree back as JSX (React, Next.js). Text that JSX would fold or read as code
// is written as a string in braces, so the page React builds is the one the tree describes.
import type { TreeAttr, TreeElement, TreeNode } from './tree.ts';

const SAFE_TEXT = /^[^\s{}<>&](?:[^{}<>&]*[^\s{}<>&])?$/;

function jsxAttr(attr: TreeAttr): string {
  const v = attr.value;
  if (v.kind === 'boolean') return v.value ? attr.name : `${attr.name}={false}`;
  if (v.kind === 'number') return `${attr.name}={${String(v.value)}}`;
  return /["&]/.test(v.value)
    ? `${attr.name}={${JSON.stringify(v.value)}}`
    : `${attr.name}="${v.value}"`;
}

function jsxText(value: string): string {
  return SAFE_TEXT.test(value) && !value.includes('\n') ? value : `{${JSON.stringify(value)}}`;
}

function renderElement(el: TreeElement, indent: string): string {
  const attrs = el.attrs.map((a) => ` ${jsxAttr(a)}`).join('');
  if (el.children.length === 0) return `${indent}<${el.tag}${attrs} />`;
  const inner = el.children
    .map((c) =>
      c.kind === 'text' ? `${indent}  ${jsxText(c.value)}` : renderElement(c, `${indent}  `),
    )
    .join('\n');
  return `${indent}<${el.tag}${attrs}>\n${inner}\n${indent}</${el.tag}>`;
}

export function renderJsx(nodes: readonly TreeNode[]): string {
  return nodes.map((n) => (n.kind === 'text' ? jsxText(n.value) : renderElement(n, ''))).join('\n');
}
