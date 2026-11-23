// Adds `data-rc-loc="file:line:col"` to the elements of a .cshtml copy (docs/architecture/03c
// section 2.4): the same stamp as JSX and Pug, so the Bridge, Canvas and Inspector work as they do.
// Only the shadow copy is stamped; the user's file is never written here.
import { lineCol, type RazorDocument, type RazorElement } from './markup.ts';

/** Page-level tags are not design elements (as for Pug); nor is anything inside `<head>`. */
const SKIP_TAGS = new Set(['html', 'head', 'body']);

function headRange(doc: RazorDocument): { start: number; end: number } | undefined {
  const head = doc.elements.find((e) => e.tag === 'head');
  if (head === undefined) return undefined;
  return { start: head.start, end: head.close?.end ?? head.openEnd };
}

function stamps(element: RazorElement, head: { start: number; end: number } | undefined): boolean {
  if (SKIP_TAGS.has(element.tag) || element.tag === 'text') return false;
  // Razor's own tags and tag helpers that render no element of their own.
  if (element.tag.includes(':') || element.tag === 'partial' || element.tag === 'environment') {
    return false;
  }
  return head === undefined || element.start < head.start || element.start >= head.end;
}

/** The text of `file` with every design element stamped with its place in the original. */
export function stampRazor(doc: RazorDocument, file: string): string {
  const head = headRange(doc);
  const inserts = doc.elements
    .filter((e) => stamps(e, head))
    .map((e) => {
      const { line, col } = lineCol(doc.text, e.start);
      return { at: e.nameEnd, attr: ` data-rc-loc="${file}:${String(line)}:${String(col)}"` };
    })
    .sort((a, b) => b.at - a.at);
  let out = doc.text;
  for (const { at, attr } of inserts) out = out.slice(0, at) + attr + out.slice(at);
  return out;
}
