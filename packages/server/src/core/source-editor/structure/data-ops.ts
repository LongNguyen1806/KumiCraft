// Execution for repeatElement (TK-31), setDataArray (TK-32), and dataContext resolution.
import * as posixPath from 'node:path/posix';

import type {
  RepeatElementEdit,
  Result,
  SetDataArrayEdit,
  StructureResult,
} from '@kumicraft/shared';
import { err, ok, relPathProblem } from '@kumicraft/shared';
import MagicString from 'magic-string';

import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { asAstNode, type AstNode, detectFormat, getJsxTagName } from '../ast-helpers.ts';
import { checkInLoop } from '../component-analyzer.ts';
import { parseModifiedCode } from '../edit-mutations.ts';
import { withFileLocks } from '../file-commit.ts';
import {
  cacheAst,
  computeSha256,
  findNodeAt,
  getCachedAst,
  validateLocAndExt,
} from '../source-editor-lookup.ts';
import type { WrittenFile } from '../source-editor-service.ts';
import {
  buildDataFileContent,
  buildRepeatedRows,
  extractRepeatableSlots,
  formatDataArrayLiteral,
  hasComplexExpression,
  isDirectReturnRoot,
  parseStaticDataArray,
} from './data-repeat-extract.ts';
import { buildMissingImportsEdits } from './imports.ts';
import { applyTextEdits, offsetToLoc } from './text-edits.ts';

export { readDataContextForNode } from './data-context.ts';

function sanitizeIdentifier(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_$]/g, '');
  if (cleaned.length === 0 || !/^[a-zA-Z_$]/.test(cleaned)) return 'items';
  return `${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
}

function toKebabName(ident: string): string {
  const k = ident
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return k.length > 0 ? k : 'items';
}

function relativeImportPath(fromFile: string, toDataRel: string): string {
  const fromDir = posixPath.dirname(fromFile.replace(/\\/g, '/'));
  const noExt = toDataRel.replace(/\.(tsx?|jsx?)$/, '');
  const rel = posixPath.relative(fromDir === '.' ? '' : fromDir, noExt);
  return rel.startsWith('.') ? rel : `./${rel}`;
}

async function resolveUniqueDataTarget(
  fs: FileSystemPort,
  projectRoot: string,
  sourceDir: string,
  baseIdent: string,
  typescript: boolean,
): Promise<{ dataRel: string; exportName: string }> {
  const cleanDir = sourceDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const dataDir = cleanDir.length > 0 ? `${cleanDir}/kumicraft/data` : 'kumicraft/data';
  const ext = typescript ? 'ts' : 'js';
  const altExt = typescript ? 'js' : 'ts';

  for (let i = 1; i <= 50; i++) {
    const suffix = i === 1 ? '' : String(i);
    const exportName = `${baseIdent}${suffix}`;
    const fileBase = `${toKebabName(exportName)}.data`;
    const candidate = `${dataDir}/${fileBase}.${ext}`;
    const altCandidate = `${dataDir}/${fileBase}.${altExt}`;
    if (
      !(await fs.exists(projectRoot, candidate)) &&
      !(await fs.exists(projectRoot, altCandidate))
    ) {
      return { dataRel: candidate, exportName };
    }
  }
  return { dataRel: `${dataDir}/${toKebabName(baseIdent)}.data.${ext}`, exportName: baseIdent };
}

function buildMappedItemJsx(
  targetNode: AstNode,
  code: string,
  slots: ReturnType<typeof extractRepeatableSlots>,
): string {
  const start = typeof targetNode.start === 'number' ? targetNode.start : 0;
  const end = typeof targetNode.end === 'number' ? targetNode.end : code.length;
  const s = new MagicString(code.slice(start, end));
  for (const slot of slots) {
    s.overwrite(slot.start - start, slot.end - start, `{item.${slot.fieldName}}`);
  }
  const opening = asAstNode(targetNode['openingElement']);
  const nameNode = asAstNode(opening?.['name']);
  const attrs = Array.isArray(opening?.['attributes']) ? opening['attributes'] : [];
  const hasKey = attrs.some((a) => asAstNode(asAstNode(a)?.['name'])?.['name'] === 'key');
  if (!hasKey && typeof nameNode?.end === 'number') {
    s.appendRight(nameNode.end - start, ' key={item.id}');
  }
  return s.toString();
}

async function writeRepeatedPair(
  fs: FileSystemPort,
  projectRoot: string,
  rel: string,
  dataRel: string,
  loc: string,
  rawSource: string,
  fileHash: string,
  nextCode: string,
  finalSource: string,
  dataContent: string,
  parsedAst: AstNode,
  onWritten?: (files: readonly WrittenFile[]) => void,
): Promise<Result<StructureResult>> {
  const afterSourceHash = computeSha256(finalSource);
  const afterDataHash = computeSha256(dataContent);
  return withFileLocks(projectRoot, [dataRel, rel].sort(), async () => {
    const wData = await fs.writeTextAtomic(projectRoot, dataRel, dataContent);
    if (!wData.ok) return wData;
    const wSrc = await fs.writeTextAtomic(projectRoot, rel, finalSource);
    if (!wSrc.ok) {
      await fs.remove(projectRoot, dataRel);
      return wSrc;
    }
    cacheAst(rel, nextCode, afterSourceHash, parsedAst);
    onWritten?.([
      {
        path: dataRel,
        before: undefined,
        after: dataContent,
        beforeHash: undefined,
        afterHash: afterDataHash,
      },
      {
        path: rel,
        before: rawSource,
        after: finalSource,
        beforeHash: fileHash,
        afterHash: afterSourceHash,
      },
    ]);
    return ok({ changed: true, files: [rel, dataRel], locs: [loc] });
  });
}

async function loadRepeatableTarget(
  fs: FileSystemPort,
  projectRoot: string,
  sourceDir: string,
  sourceExtensions: readonly string[],
  edit: RepeatElementEdit,
) {
  const valRes = validateLocAndExt(edit.loc, sourceDir, sourceExtensions);
  if (!valRes.ok) return valRes;
  const { rel, line, column } = valRes.value;
  const readRes = await fs.readText(projectRoot, rel, { maxBytes: 1_000_000, keepBom: true });
  if (!readRes.ok) return readRes;
  const rawContent = readRes.value;
  const { hasBom, newline } = detectFormat(rawContent);
  const code = hasBom ? rawContent.slice(1) : rawContent;
  const fileHash = computeSha256(rawContent);
  const ast = getCachedAst(rel, code, fileHash);
  const targetNode = findNodeAt(ast, line, column);
  if (!targetNode || targetNode.start === undefined || targetNode.end === undefined) {
    return err({ code: 'E017', params: { loc: edit.loc, reason: 'moved' } });
  }
  const opening = asAstNode(targetNode['openingElement']);
  if (!opening || getJsxTagName(opening) !== edit.tag) {
    return err({ code: 'E017', params: { loc: edit.loc, reason: 'moved' } });
  }
  if (checkInLoop(ast, targetNode))
    return err({ code: 'E023', params: { reason: 'alreadyInLoop' } });
  if (isDirectReturnRoot(ast, targetNode))
    return err({ code: 'E023', params: { reason: 'returnRoot' } });
  if (hasComplexExpression(targetNode))
    return err({ code: 'E023', params: { reason: 'complexExpression' } });
  return ok({
    rel,
    rawContent,
    hasBom,
    newline,
    code,
    fileHash,
    ast,
    targetNode,
    start: targetNode.start,
    end: targetNode.end,
  });
}

function buildRepeatedSourceEdit(
  prep: {
    readonly rel: string;
    readonly newline: '\r\n' | '\n';
    readonly code: string;
    readonly ast: AstNode;
    readonly targetNode: AstNode;
    readonly start: number;
    readonly end: number;
  },
  slots: ReturnType<typeof extractRepeatableSlots>,
  dataRel: string,
  exportName: string,
): Result<{ readonly nextCode: string; readonly nextLoc: string; readonly parsedAst: AstNode }> {
  const mapPrefix = `{${exportName}.map((item) => (${prep.newline}`;
  const mapExpr = `${mapPrefix}${buildMappedItemJsx(prep.targetNode, prep.code, slots)}${prep.newline}))}`;
  const importRes = buildMissingImportsEdits(
    prep.ast,
    prep.code,
    prep.rel,
    [exportName],
    {
      file: prep.rel,
      imports: [`import { ${exportName} } from '${relativeImportPath(prep.rel, dataRel)}';`],
    },
    prep.newline,
  );
  const editedRes = applyTextEdits(prep.code, [
    ...importRes.edits,
    { start: prep.start, end: prep.end, text: mapExpr },
  ]);
  if (!editedRes.ok) return editedRes;
  const nextCode = editedRes.value.code;
  const importShift = importRes.edits.reduce(
    (s, e) => s + (e.start <= prep.start ? e.text.length - (e.end - e.start) : 0),
    0,
  );
  const parsedCheck = parseModifiedCode(nextCode);
  if (!parsedCheck.ok) return parsedCheck;
  return ok({
    nextCode,
    nextLoc: offsetToLoc(prep.rel, nextCode, prep.start + importShift + mapPrefix.length),
    parsedAst: parsedCheck.value,
  });
}

export async function executeRepeatElement(
  fs: FileSystemPort,
  projectRoot: string,
  sourceDir: string,
  sourceExtensions: readonly string[],
  edit: RepeatElementEdit,
  onWritten?: (files: readonly WrittenFile[]) => void,
): Promise<Result<StructureResult>> {
  const prep = await loadRepeatableTarget(fs, projectRoot, sourceDir, sourceExtensions, edit);
  if (!prep.ok) return prep;
  const { rel, rawContent, hasBom, newline, fileHash, targetNode } = prep.value;
  const slots = extractRepeatableSlots(targetNode);
  const { dataRel, exportName } = await resolveUniqueDataTarget(
    fs,
    projectRoot,
    sourceDir,
    sanitizeIdentifier(edit.name ?? 'items'),
    rel.endsWith('.tsx') || rel.endsWith('.ts'),
  );
  const dataContent = buildDataFileContent(
    exportName,
    buildRepeatedRows(slots, edit.count ?? 3),
    newline,
  );
  const built = buildRepeatedSourceEdit(prep.value, slots, dataRel, exportName);
  if (!built.ok) return built;
  return writeRepeatedPair(
    fs,
    projectRoot,
    rel,
    dataRel,
    built.value.nextLoc,
    rawContent,
    fileHash,
    built.value.nextCode,
    hasBom ? `\uFEFF${built.value.nextCode}` : built.value.nextCode,
    dataContent,
    built.value.parsedAst,
    onWritten,
  );
}

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
