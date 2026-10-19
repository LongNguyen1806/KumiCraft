// Batch edit executor for Source Editor (R-CB-15, spec-log #22).
import type { AttributeLevelEdit, BatchEditResult, Result } from '@reactcraft/shared';
import { err, ok } from '@reactcraft/shared';
import MagicString from 'magic-string';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { asAstNode, detectFormat, getJsxTagName } from './ast-helpers.ts';
import { executeEditMutation, parseModifiedCode } from './edit-mutations.ts';
import { commitPreparedFiles, type PreparedFileWrite, withFileLocks } from './file-commit.ts';
import {
  computeSha256,
  findNodeAt,
  getCachedAst,
  validateLocAndExt,
} from './source-editor-lookup.ts';
import type { WrittenFile } from './source-editor-service.ts';

const MAX_FILE_SIZE = 1024 * 1024;

type ValidatedEdit = {
  readonly edit: AttributeLevelEdit;
  readonly rel: string;
  readonly line: number;
  readonly column: number;
};

function editKey(edit: AttributeLevelEdit): string {
  if (edit.kind === 'setAttribute') return `${edit.loc}:attr:${edit.name}`;
  if (edit.kind === 'setFlag') return `${edit.loc}:flag:${edit.name}`;
  return `${edit.loc}:${edit.kind}`;
}

function validateAndGroupEdits(
  edits: readonly AttributeLevelEdit[],
  sourceDir: string,
  sourceExtensions: readonly string[],
): Result<{
  readonly byFile: ReadonlyMap<string, readonly ValidatedEdit[]>;
  readonly sortedFiles: readonly string[];
}> {
  const keysSeen = new Set<string>();
  const validated: ValidatedEdit[] = [];

  for (const edit of edits) {
    const key = editKey(edit);
    if (keysSeen.has(key)) {
      return err({ code: 'E016', params: { reason: 'duplicateLoc' } });
    }
    keysSeen.add(key);

    const valRes = validateLocAndExt(edit.loc, sourceDir, sourceExtensions);
    if (!valRes.ok) return valRes;

    validated.push({
      edit,
      rel: valRes.value.rel,
      line: valRes.value.line,
      column: valRes.value.column,
    });
  }

  const map = new Map<string, ValidatedEdit[]>();
  for (const item of validated) {
    const list = map.get(item.rel) ?? [];
    list.push(item);
    map.set(item.rel, list);
  }

  const sortedFiles = [...map.keys()].sort((a, b) => a.localeCompare(b));
  return ok({ byFile: map, sortedFiles });
}

type PreparedFileResult = {
  readonly prepared?: PreparedFileWrite | undefined;
};

async function prepareFileEdits(
  fs: FileSystemPort,
  projectRoot: string,
  rel: string,
  items: readonly ValidatedEdit[],
): Promise<Result<PreparedFileResult>> {
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
  const s = new MagicString(code);

  for (const item of items) {
    const targetNode = findNodeAt(ast, item.line, item.column);
    if (!targetNode) {
      return err({ code: 'E017', params: { loc: item.edit.loc, reason: 'moved' } });
    }
    const opening = asAstNode(targetNode['openingElement']) ?? { type: 'JSXOpeningElement' };
    if (getJsxTagName(opening) !== item.edit.tag) {
      return err({ code: 'E017', params: { loc: item.edit.loc, reason: 'moved' } });
    }

    const mutateRes = executeEditMutation(item.edit, targetNode, opening, code, s, newline);
    if (!mutateRes.ok) return mutateRes;
  }

  const modifiedCode = s.toString();
  if (modifiedCode === code) return ok({});

  const nextAstRes = parseModifiedCode(modifiedCode);
  if (!nextAstRes.ok) return nextAstRes;

  const finalContent = hasBom ? `\uFEFF${modifiedCode}` : modifiedCode;
  return ok({
    prepared: {
      rel,
      rawBefore,
      beforeHash,
      modifiedCode,
      finalContent,
      nextAst: nextAstRes.value,
      locs: [],
      warnings: [],
    },
  });
}

export async function executeEditBatch(
  fs: FileSystemPort,
  projectRoot: string,
  sourceDir: string,
  sourceExtensions: readonly string[],
  edits: readonly AttributeLevelEdit[],
  onWritten?: (files: readonly WrittenFile[]) => void,
): Promise<Result<BatchEditResult>> {
  const groupRes = validateAndGroupEdits(edits, sourceDir, sourceExtensions);
  if (!groupRes.ok) return groupRes;

  const { byFile, sortedFiles } = groupRes.value;

  return withFileLocks(projectRoot, sortedFiles, async () => {
    const preparedList: PreparedFileWrite[] = [];

    for (const rel of sortedFiles) {
      const items = byFile.get(rel) ?? [];
      const prepRes = await prepareFileEdits(fs, projectRoot, rel, items);
      if (!prepRes.ok) return prepRes;
      if (prepRes.value.prepared !== undefined) {
        preparedList.push(prepRes.value.prepared);
      }
    }

    if (preparedList.length === 0) {
      return ok({ changed: false, files: [] });
    }

    const commitRes = await commitPreparedFiles(fs, projectRoot, preparedList);
    if (!commitRes.ok) return commitRes;

    onWritten?.(commitRes.value);
    return ok({
      changed: true,
      files: commitRes.value.map((f) => f.path),
    });
  });
}
