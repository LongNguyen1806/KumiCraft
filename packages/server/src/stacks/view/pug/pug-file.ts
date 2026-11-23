// A .pug file as the Pug editor reads it (docs/architecture/03d section 2.1): its bytes, hash and
// elements read with Pug's own lexer; kept per file hash.
import { err, ok, type Result } from '@kumicraft/shared';

import { computeSha256 } from '../../../kernel/history/history-file-io.ts';
import type { TextViewFile } from '../../../kernel/text-view-editor.ts';
import { type PugDocument, type PugElement, readPugMarkup } from '../../../lib/pug/markup.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';

const MAX_FILE_BYTES = 1024 * 1024;
const BOM = '\uFEFF';

export type PugFile = TextViewFile & { readonly doc: PugDocument };

const files = new Map<string, PugFile>();

export async function loadPugFile(
  fs: FileSystemPort,
  root: string,
  rel: string,
): Promise<Result<PugFile>> {
  const read = await fs.readText(root, rel, { maxBytes: MAX_FILE_BYTES, keepBom: true });
  if (!read.ok) return read;
  const raw = read.value;
  const hash = computeSha256(raw);
  const key = `${root}\u0000${rel}`;
  const cached = files.get(key);
  if (cached?.hash === hash) return ok(cached);
  const bom = raw.startsWith(BOM);
  const text = bom ? raw.slice(1) : raw;
  try {
    const doc = readPugMarkup(text, rel);
    const newline = text.includes('\r\n') ? '\r\n' : '\n';
    const file: PugFile = { rel, raw, hash, text, bom, newline, doc };
    files.set(key, file);
    return ok(file);
  } catch (cause: unknown) {
    // Not valid Pug (typing in progress): Pug's own message says where.
    const message = cause instanceof Error ? cause.message : String(cause);
    return err({ code: 'E023', params: { file: rel, reason: 'pugNotRead', message } });
  }
}

export function pugElementAt(file: PugFile, line: number, column: number): PugElement | undefined {
  return file.doc.elements.find((e) => e.line === line && e.col === column);
}
