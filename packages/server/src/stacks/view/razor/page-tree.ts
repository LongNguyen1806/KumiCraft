// The element tree of a .cshtml and the project's view and style files, for AI agents (R-AG-19):
// the same answers the JSX editor gives, read from Razor.
import {
  ok,
  PAGE_TREE_MAX_DEPTH,
  PAGE_TREE_MAX_NODES,
  type PageTree,
  type PageTreeNode,
  type Result,
} from '@kumicraft/shared';

import type { SourceFiles } from '../../../kernel/editing.ts';
import type { RazorElement, RazorNode } from '../../../lib/razor/markup.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';
import { readText } from './element-source.ts';
import { locOf, type RazorFile } from './razor-file.ts';

const LISTED = ['.cshtml', '.cs', '.css', '.scss', '.js'];
const SKIPPED = new Set(['bin', 'obj', 'node_modules', 'lib']);
const MAX_FILES = 2000;

type Count = { nodes: number; truncated: boolean };

function nodeOf(
  file: RazorFile,
  el: RazorElement,
  depth: number,
  maxDepth: number,
  count: Count,
): PageTreeNode {
  count.nodes += 1;
  const text = file.doc.text;
  const cls = el.attrs.find((a) => a.name === 'class')?.value;
  const className =
    cls !== undefined && cls.parts.every((p) => p.kind === 'static')
      ? readText(text.slice(cls.start, cls.end))
      : undefined;
  const own = el.children
    .filter((c) => c.kind === 'text')
    .map((c) => text.slice(c.start, c.end).trim())
    .join(' ')
    .trim();
  const children =
    depth >= maxDepth ? [] : childrenOf(file, el.children, depth + 1, maxDepth, count);
  return {
    loc: locOf(file.rel, text, el),
    tag: el.tag,
    kind: 'element',
    ...(className === undefined ? {} : { className }),
    ...(own === '' ? {} : { text: readText(own).slice(0, 80) }),
    children,
  };
}

function childrenOf(
  file: RazorFile,
  nodes: readonly RazorNode[],
  depth: number,
  maxDepth: number,
  count: Count,
): PageTreeNode[] {
  const out: PageTreeNode[] = [];
  for (const node of nodes) {
    if (node.kind !== 'element') continue;
    if (count.nodes >= PAGE_TREE_MAX_NODES) {
      count.truncated = true;
      break;
    }
    out.push(nodeOf(file, node, depth, maxDepth, count));
  }
  return out;
}

export function razorPageTree(file: RazorFile, maxDepth = PAGE_TREE_MAX_DEPTH): PageTree {
  const count: Count = { nodes: 0, truncated: false };
  const roots = childrenOf(file, file.doc.roots, 1, maxDepth, count);
  return { file: file.rel, roots, truncated: count.truncated };
}

async function scan(
  fs: FileSystemPort,
  root: string,
  dir: string,
  out: string[],
): Promise<boolean> {
  const read = await fs.readDir(root, dir === '' ? '.' : dir);
  if (!read.ok) return false;
  for (const entry of [...read.value].sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || SKIPPED.has(entry.name)) continue;
    const path = dir === '' ? entry.name : `${dir}/${entry.name}`;
    if (entry.kind === 'directory') {
      if (await scan(fs, root, path, out)) return true;
    } else if (LISTED.some((ext) => entry.name.endsWith(ext))) {
      out.push(path);
      if (out.length >= MAX_FILES) return true;
    }
  }
  return false;
}

/** The views, code and style files of an ASP.NET project (wwwroot/lib, bin, obj skipped). */
export async function razorSourceFiles(
  fs: FileSystemPort,
  root: string,
): Promise<Result<SourceFiles>> {
  const files: string[] = [];
  const truncated = await scan(fs, root, '', files);
  return ok({ files, truncated });
}
