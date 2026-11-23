// A .cshtml file as the Razor editor reads it (docs/architecture/03c section 2.3): its bytes, its
// hash, and its HTML read with the C# ranges the Razor helper found. Kept per file hash, so the
// helper runs once per version of a file.
import { err, ok, parseLocString, type Result } from '@kumicraft/shared';

import { computeSha256 } from '../../../kernel/history/history-file-io.ts';
import {
  lineCol,
  type RazorDocument,
  type RazorElement,
  readRazorMarkup,
  type Span,
} from '../../../lib/razor/markup.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';

const MAX_FILE_BYTES = 1024 * 1024;
const BOM = '\uFEFF';

/** How the editor reads files: the project's files, and the C# ranges of a .cshtml (03c 2.2). */
export type RazorIo = {
  readonly fs: FileSystemPort;
  readonly codeRanges: (root: string, file: string, text: string) => Promise<readonly Span[]>;
};

export type RazorFile = {
  readonly rel: string;
  /** The file as on disk (BOM included). */
  readonly raw: string;
  readonly hash: string;
  readonly bom: boolean;
  readonly newline: '\r\n' | '\n';
  /** The text without its BOM: the offsets of `doc` are in it. */
  readonly text: string;
  readonly doc: RazorDocument;
};

const files = new Map<string, RazorFile>();

/** Reads a .cshtml of the project with its elements. */
export async function loadRazorFile(
  io: RazorIo,
  root: string,
  rel: string,
): Promise<Result<RazorFile>> {
  const read = await io.fs.readText(root, rel, { maxBytes: MAX_FILE_BYTES, keepBom: true });
  if (!read.ok) return read;
  const raw = read.value;
  const hash = computeSha256(raw);
  const key = `${root}\u0000${rel}`;
  const cached = files.get(key);
  if (cached?.hash === hash) return ok(cached);
  const bom = raw.startsWith(BOM);
  const text = bom ? raw.slice(1) : raw;
  try {
    const code = await io.codeRanges(root, rel, text);
    const file: RazorFile = {
      rel,
      raw,
      hash,
      bom,
      newline: text.includes('\r\n') ? '\r\n' : '\n',
      text,
      doc: readRazorMarkup(text, code),
    };
    files.set(key, file);
    return ok(file);
  } catch (cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return err({ code: 'E023', params: { file: rel, reason: 'razorNotRead', message } });
  }
}

/** The file's text without its BOM (offsets of the document are in it). */
export const textOf = (file: RazorFile): string => file.doc.text;

/** The content to write for a new text of the file (BOM kept). */
export const rawOf = (file: RazorFile, text: string): string => (file.bom ? BOM : '') + text;

/** The element whose `<` is at the loc's line and column. */
export function elementAt(file: RazorFile, line: number, column: number): RazorElement | undefined {
  return file.doc.elements.find((element) => {
    const at = lineCol(file.doc.text, element.start);
    return at.line === line && at.col === column;
  });
}

/** The loc of an element, as the stamp in the page writes it. */
export function locOf(rel: string, text: string, element: RazorElement): string {
  const { line, col } = lineCol(text, element.start);
  return `${rel}:${String(line)}:${String(col)}`;
}

export type LocatedElement = { readonly file: RazorFile; readonly element: RazorElement };

/** The file and element a loc names, checking the file is a Razor view of the project. */
export async function locate(
  io: RazorIo,
  root: string,
  loc: string,
): Promise<Result<LocatedElement>> {
  const parsed = parseLocString(loc);
  if (parsed === undefined) return err({ code: 'E016', params: { field: 'loc' } });
  if (!parsed.file.endsWith('.cshtml')) {
    return err({ code: 'E023', params: { file: parsed.file, reason: 'notRazorFile' } });
  }
  const file = await loadRazorFile(io, root, parsed.file);
  if (!file.ok) return file;
  const element = elementAt(file.value, parsed.line, parsed.column);
  if (element === undefined) return err({ code: 'E017', params: { reason: 'moved' } });
  return ok({ file: file.value, element });
}
