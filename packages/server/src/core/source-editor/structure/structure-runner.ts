// Multi-file coordinator for structural JSX edits (SPEC-04 section 14, R-SE-29).
import type { ElementGuard, Result, StructureEdit, StructureResult } from '@reactcraft/shared';
import { err, ok } from '@reactcraft/shared';

import type { FileSystemPort } from '../../ports/file-system-port.ts';
import {
  asAstNode,
  type AstNode,
  detectFormat,
  getJsxTagName,
  parseJsxAst,
} from '../ast-helpers.ts';
import { fileQueueKey, queueFileTask } from '../file-queue.ts';
import {
  cacheAst,
  computeSha256,
  findNodeAt,
  getCachedAst,
  validateLocAndExt,
} from '../source-editor-lookup.ts';
import type { WrittenFile } from '../source-editor-service.ts';
import {
  buildDuplicateTextEdits,
  buildInsertTextEdit,
  buildRemoveTextEdits,
  type ResolvedElement,
  validateInsertedJsx,
} from './structure-ops.ts';
import { applyTextEdits, type TextEdit } from './text-edits.ts';

const MAX_FILE_SIZE = 1024 * 1024;

type GuardWithPosition = {
  readonly loc: string;
  readonly tag: string;
  readonly rel: string;
  readonly line: number;
  readonly column: number;
};

type PreparedFileWrite = {
  readonly rel: string;
  readonly rawBefore: string;
  readonly beforeHash: string;
  readonly modifiedCode: string;
  readonly finalContent: string;
  readonly nextAst: AstNode;
  readonly locs: readonly string[];
};

function offsetToLoc(rel: string, code: string, offset: number): string {
  let line = 1;
  let lastNewline = -1;
  for (let i = 0; i < offset && i < code.length; i++) {
    if (code[i] === '\n') {
      line++;
      lastNewline = i;
    }
  }
  const column = lastNewline === -1 ? offset + 1 : offset - lastNewline;
  return `${rel}:${String(line)}:${String(column)}`;
}

function parseModifiedAst(code: string): Result<AstNode> {
  try {
    return ok(parseJsxAst(code));
  } catch (e) {
    const syntaxErr = e as { loc?: { line?: number; column?: number } };
    return err({
      code: 'E024',
      params: {
        line: syntaxErr.loc?.line ?? 1,
        column: (syntaxErr.loc?.column ?? 0) + 1,
      },
    });
  }
}

function validateGuards(
  guards: readonly ElementGuard[],
  sourceDir: string,
  sourceExtensions: readonly string[],
): Result<readonly GuardWithPosition[]> {
  const out: GuardWithPosition[] = [];
  for (const g of guards) {
    const valRes = validateLocAndExt(g.loc, sourceDir, sourceExtensions);
    if (!valRes.ok) return valRes;
    out.push({
      loc: g.loc,
      tag: g.tag,
      rel: valRes.value.rel,
      line: valRes.value.line,
      column: valRes.value.column,
    });
  }
  return ok(out);
}

function resolveElementsInAst(
  ast: AstNode,
  guards: readonly GuardWithPosition[],
): Result<readonly ResolvedElement[]> {
  const resolved: ResolvedElement[] = [];
  for (const g of guards) {
    const node = findNodeAt(ast, g.line, g.column);
    if (!node || node.start === undefined || node.end === undefined) {
      return err({ code: 'E017', params: { loc: g.loc, reason: 'moved' } });
    }
    const opening = asAstNode(node['openingElement']) ?? { type: 'JSXOpeningElement' };
    if (getJsxTagName(opening) !== g.tag) {
      return err({ code: 'E017', params: { loc: g.loc, reason: 'moved' } });
    }
    resolved.push({
      loc: g.loc,
      node,
      opening,
      start: node.start,
      end: node.end,
      line: g.line,
    });
  }
  return ok(resolved);
}

function buildFileTextEdits(
  edit: StructureEdit,
  ast: AstNode,
  code: string,
  nl: '\r\n' | '\n',
  resolved: readonly ResolvedElement[],
): Result<readonly TextEdit[]> {
  if (edit.kind === 'insert') {
    const first = resolved[0];
    if (!first) return err({ code: 'E016', params: { reason: 'empty' } });
    const single = buildInsertTextEdit(
      ast,
      code,
      nl,
      edit.target.kind,
      edit.target.where,
      first,
      edit.jsx,
    );
    return single.ok ? ok([single.value]) : single;
  }
  if (edit.kind === 'remove') {
    return buildRemoveTextEdits(ast, code, resolved);
  }
  return buildDuplicateTextEdits(ast, code, nl, resolved);
}

async function prepareFileStructureEdit(
  fs: FileSystemPort,
  projectRoot: string,
  rel: string,
  guards: readonly GuardWithPosition[],
  edit: StructureEdit,
): Promise<Result<PreparedFileWrite | undefined>> {
  const readRes = await fs.readText(projectRoot, rel, { maxBytes: MAX_FILE_SIZE, keepBom: true });
  if (!readRes.ok) {
    if (readRes.error.params?.['reason'] === 'tooLarge') {
      return err({ code: 'E023', params: { file: rel, reason: 'tooLarge' } });
    }
    return readRes;
  }

  const rawBefore = readRes.value;
  const { hasBom, newline } = detectFormat(rawBefore);
  const code = hasBom ? rawBefore.slice(1) : rawBefore;
  const beforeHash = computeSha256(rawBefore);
  const ast = getCachedAst(rel, code, beforeHash);

  const resolvedRes = resolveElementsInAst(ast, guards);
  if (!resolvedRes.ok) return resolvedRes;

  const editsRes = buildFileTextEdits(edit, ast, code, newline, resolvedRes.value);
  if (!editsRes.ok) return editsRes;

  const appliedRes = applyTextEdits(code, editsRes.value);
  if (!appliedRes.ok) return appliedRes;

  const { code: modifiedCode, marks } = appliedRes.value;
  if (modifiedCode === code) return ok(undefined);

  const nextAstRes = parseModifiedAst(modifiedCode);
  if (!nextAstRes.ok) return nextAstRes;

  const finalContent = hasBom ? `\uFEFF${modifiedCode}` : modifiedCode;
  const locs =
    edit.kind === 'remove' ? [] : marks.map((offset) => offsetToLoc(rel, modifiedCode, offset));

  return ok({
    rel,
    rawBefore,
    beforeHash,
    modifiedCode,
    finalContent,
    nextAst: nextAstRes.value,
    locs,
  });
}

async function commitPreparedFiles(
  fs: FileSystemPort,
  projectRoot: string,
  prepared: readonly PreparedFileWrite[],
): Promise<Result<readonly WrittenFile[]>> {
  const written: WrittenFile[] = [];
  const committed: PreparedFileWrite[] = [];

  for (const item of prepared) {
    const writeRes = await fs.writeTextAtomic(projectRoot, item.rel, item.finalContent);
    if (!writeRes.ok) {
      for (const prev of committed) {
        await fs.writeTextAtomic(projectRoot, prev.rel, prev.rawBefore);
      }
      return writeRes;
    }
    const afterHash = computeSha256(item.finalContent);
    cacheAst(item.rel, item.modifiedCode, afterHash, item.nextAst);
    committed.push(item);
    written.push({
      path: item.rel,
      before: item.rawBefore,
      after: item.finalContent,
      beforeHash: item.beforeHash,
      afterHash,
    });
  }

  return ok(written);
}

async function withFileLocks<T>(
  projectRoot: string,
  sortedFiles: readonly string[],
  task: () => Promise<T>,
  index = 0,
): Promise<T> {
  const file = sortedFiles[index];
  if (file === undefined) return task();
  return queueFileTask(fileQueueKey(projectRoot, file), () =>
    withFileLocks(projectRoot, sortedFiles, task, index + 1),
  );
}

export async function executeStructureEdit(
  fs: FileSystemPort,
  projectRoot: string,
  sourceDir: string,
  sourceExtensions: readonly string[],
  edit: StructureEdit,
  onWritten?: (files: readonly WrittenFile[]) => void,
): Promise<Result<StructureResult>> {
  if (edit.kind === 'insert') {
    const jsxCheck = validateInsertedJsx(edit.jsx);
    if (!jsxCheck.ok) return jsxCheck;
  }

  const rawGuards: readonly ElementGuard[] =
    edit.kind === 'insert'
      ? [edit.target.kind === 'sibling' ? edit.target.ref : edit.target.parent]
      : edit.elements;

  const validatedRes = validateGuards(rawGuards, sourceDir, sourceExtensions);
  if (!validatedRes.ok) return validatedRes;

  const byFile = new Map<string, GuardWithPosition[]>();
  for (const g of validatedRes.value) {
    const list = byFile.get(g.rel) ?? [];
    list.push(g);
    byFile.set(g.rel, list);
  }

  const sortedFiles = [...byFile.keys()].sort((a, b) => a.localeCompare(b));

  return withFileLocks(projectRoot, sortedFiles, async () => {
    const prepared: PreparedFileWrite[] = [];
    for (const rel of sortedFiles) {
      const guards = byFile.get(rel) ?? [];
      const prepRes = await prepareFileStructureEdit(fs, projectRoot, rel, guards, edit);
      if (!prepRes.ok) return prepRes;
      if (prepRes.value !== undefined) {
        prepared.push(prepRes.value);
      }
    }

    if (prepared.length === 0) {
      return ok({ changed: false, files: [], locs: [] });
    }

    const commitRes = await commitPreparedFiles(fs, projectRoot, prepared);
    if (!commitRes.ok) return commitRes;

    onWritten?.(commitRes.value);

    return ok({
      changed: true,
      files: prepared.map((p) => p.rel),
      locs: prepared.flatMap((p) => p.locs),
    });
  });
}
