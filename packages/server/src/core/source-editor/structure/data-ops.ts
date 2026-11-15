// Execution for setDataArray (TK-32) and dataContext resolution (the repeat tool was removed 2026-11-15).
import type { Result, SetDataArrayEdit, StructureResult } from '@kumicraft/shared';
import { err, ok, relPathProblem } from '@kumicraft/shared';
import MagicString from 'magic-string';

import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { detectFormat } from '../ast-helpers.ts';
import { withFileLocks } from '../file-commit.ts';
import { computeSha256 } from '../source-editor-lookup.ts';
import type { WrittenFile } from '../source-editor-service.ts';
import { formatDataArrayLiteral, parseStaticDataArray } from './data-repeat-extract.ts';

export { readDataContextForNode } from './data-context.ts';

async function rewriteDataArrayFile(
  fs: FileSystemPort,
  projectRoot: string,
  edit: SetDataArrayEdit,
  onWritten?: (files: readonly WrittenFile[]) => void,
): Promise<Result<StructureResult>> {
  const readRes = await fs.readText(projectRoot, edit.file, { maxBytes: 1_000_000, keepBom: true });
  if (!readRes.ok) return readRes;
  const rawContent = readRes.value;
  const { hasBom, newline } = detectFormat(rawContent);
  const code = hasBom ? rawContent.slice(1) : rawContent;
  const parsed = parseStaticDataArray(code, edit.exportName);
  if ('invalidReason' in parsed) {
    return err({
      code: 'E023',
      params: { reason: 'invalidDataArray', detail: parsed.invalidReason },
    });
  }
  if (typeof parsed.initNode.start !== 'number' || typeof parsed.initNode.end !== 'number') {
    return err({ code: 'E023', params: { reason: 'invalidDataArray' } });
  }
  const s = new MagicString(code);
  s.overwrite(
    parsed.initNode.start,
    parsed.initNode.end,
    formatDataArrayLiteral(edit.rows, newline),
  );
  const finalContent = hasBom ? `\uFEFF${s.toString()}` : s.toString();
  const beforeHash = computeSha256(rawContent);
  const afterHash = computeSha256(finalContent);
  if (beforeHash === afterHash) return ok({ changed: false, files: [], locs: [] });
  const w = await fs.writeTextAtomic(projectRoot, edit.file, finalContent);
  if (!w.ok) return w;
  onWritten?.([
    { path: edit.file, before: rawContent, after: finalContent, beforeHash, afterHash },
  ]);
  return ok({ changed: true, files: [edit.file], locs: [] });
}

export async function executeSetDataArray(
  fs: FileSystemPort,
  projectRoot: string,
  sourceDir: string,
  edit: SetDataArrayEdit,
  onWritten?: (files: readonly WrittenFile[]) => void,
): Promise<Result<StructureResult>> {
  if (relPathProblem(edit.file) !== undefined)
    return err({ code: 'E012', params: { path: edit.file } });
  const normSource = sourceDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (normSource.length > 0 && !edit.file.startsWith(`${normSource}/`)) {
    return err({ code: 'E012', params: { path: edit.file } });
  }
  if (!/\.data\.(ts|js|tsx|jsx)$/.test(edit.file)) {
    return err({ code: 'E023', params: { reason: 'invalidDataArray' } });
  }
  return withFileLocks(projectRoot, [edit.file], () =>
    rewriteDataArrayFile(fs, projectRoot, edit, onWritten),
  );
}
