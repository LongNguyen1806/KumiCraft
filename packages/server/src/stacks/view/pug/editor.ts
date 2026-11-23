// The Pug editor (docs/architecture/03d): .pug as a text view language. Pug finds its elements with
// Pug's own lexer and plans text changes on their lines; the kernel's text view editor locates,
// writes, records Undo, and saves images and block CSS.
import {
  ok,
  PAGE_TREE_MAX_DEPTH,
  type PageTree,
  type PageTreeNode,
  type Result,
  type StylingReport,
} from '@kumicraft/shared';

import type { SourceEditorService, SourceFiles } from '../../../kernel/editing.ts';
import { createTextViewEditor, type TextViewLanguage } from '../../../kernel/text-view-editor.ts';
import type { PugElement } from '../../../lib/pug/markup.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';
import { pugElementEdit } from './element-edits.ts';
import { pugElementSource, readPugText, stringValue } from './element-source.ts';
import { loadPugFile, pugElementAt, type PugFile } from './pug-file.ts';
import { planPugStructure } from './structure-ops.ts';

export type PugEditorDeps = {
  readonly fs: FileSystemPort;
  readonly styling: () => StylingReport | undefined;
};

const LISTED = ['.pug', '.js', '.css', '.scss'];
const SKIPPED = new Set(['node_modules', 'dist', 'build', 'coverage']);
const MAX_FILES = 2000;

/** The elements of a file as a tree: an element holds those on the lines of its block. */
function pugPageTree(file: PugFile, maxDepth = PAGE_TREE_MAX_DEPTH): PageTree {
  const nodeOf = (el: PugElement, depth: number): PageTreeNode => {
    const children = file.doc.elements.filter((c) => c !== el && parentOf(c) === el);
    const cls = el.parts.filter((p) => p.kind === 'class').map((p) => p.name);
    const classAttr = el.attrs.find((a) => a.name === 'class');
    const written = classAttr === undefined ? undefined : stringValue(classAttr.val);
    const className = [...cls, ...(written === undefined ? [] : [written])].join(' ');
    const text = el.inline.kind === 'text' ? readPugText(el.inline.value.trim()).slice(0, 80) : '';
    return {
      loc: `${file.rel}:${String(el.line)}:${String(el.col)}`,
      tag: el.tag,
      kind: 'element',
      ...(className === '' ? {} : { className }),
      ...(text === '' ? {} : { text }),
      children: depth >= maxDepth ? [] : children.map((c) => nodeOf(c, depth + 1)),
    };
  };
  const parentOf = (el: PugElement): PugElement | undefined =>
    file.doc.elements
      .filter(
        (p) =>
          p !== el &&
          (p.childLines.includes(el.line) ||
            (el.expanded && p.line === el.line && p.start < el.start)),
      )
      .sort((a, b) => b.start - a.start)[0];
  const roots = file.doc.elements.filter((el) => parentOf(el) === undefined);
  return { file: file.rel, roots: roots.map((el) => nodeOf(el, 1)), truncated: false };
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

async function pugSourceFiles(fs: FileSystemPort, root: string): Promise<Result<SourceFiles>> {
  const files: string[] = [];
  const truncated = await scan(fs, root, '', files);
  return ok({ files, truncated });
}

export function pugLanguage(deps: PugEditorDeps): TextViewLanguage<PugFile, PugElement> {
  return {
    extension: '.pug',
    notFileReason: 'notPugFile',
    imagesDir: 'public/images',
    imagesUrl: '/images',
    defaultCss: 'public/style.css',
    load: (root, rel) => loadPugFile(deps.fs, root, rel),
    elementAt: pugElementAt,
    tagOf: (el) => el.tag,
    source: (file, el, loc) => pugElementSource(file.doc, el, loc, file.hash),
    outerText: (file, el) => file.text.slice(el.lineStart, el.blockEnd),
    edit: (file, el, edit) => pugElementEdit(file.doc, el, edit),
    structure: (input, edit) =>
      planPugStructure(
        {
          doc: input.file.doc,
          newline: input.file.newline,
          styling: input.styling,
          elements: input.elements,
          ref: input.ref,
          imageSrc: input.imageSrc,
        },
        edit,
      ),
    pageTree: pugPageTree,
    sourceFiles: (root) => pugSourceFiles(deps.fs, root),
  };
}

/** The Pug views' SourceEditorService. */
export function createPugEditor(deps: PugEditorDeps): SourceEditorService {
  return createTextViewEditor(pugLanguage(deps), deps);
}
