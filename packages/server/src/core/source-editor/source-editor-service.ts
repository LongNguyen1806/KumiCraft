// Source Editor Service implementing M-SE (SPEC-03 section 5.5, SPEC-04 section 6).
import type {
  AttributeLevelEdit,
  BatchEditResult,
  EditResult,
  ElementSource,
  ElementText,
  PageTree,
  Result,
  SourceEdit,
  StructureEdit,
  StructureResult,
} from '@reactcraft/shared';
import { err, ok, parseLocString } from '@reactcraft/shared';
import MagicString from 'magic-string';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { AstNode } from './ast-helpers.ts';
import { asAstNode, detectFormat, getJsxTagName } from './ast-helpers.ts';
import { createUsageCounter, type UsageCounter } from './component-usages.ts';
import { executeEditBatch } from './edit-batch.ts';
import { executeEditMutation, parseModifiedCode } from './edit-mutations.ts';
import { fileQueueKey, queueFileTask } from './file-queue.ts';
import { readPageTree } from './page-tree.ts';
import { createSnippetFormatter, type SnippetFormatter } from './snippet-format.ts';
import {
  buildElementSource,
  cacheAst,
  computeSha256,
  findNodeAt,
  getCachedAst,
  validateLocAndExt,
} from './source-editor-lookup.ts';
import { listSourceFiles, type SourceFiles } from './source-files.ts';
import { getElementTextFromAst } from './structure/element-text.ts';
import { executeStructureEdit } from './structure/structure-runner.ts';

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB (R-SE-01)

export type SourceEditorDeps = {
  readonly fs: FileSystemPort;
  readonly usageCounter?: UsageCounter | undefined;
  /** Lays out inserted JSX (M-FM); absent: the built-in layout without the project's Prettier. */
  readonly formatSnippet?: SnippetFormatter | undefined;
};

export type SourceEditorConfig = {
  readonly sourceDir?: string | undefined;
  readonly sourceExtensions?: readonly string[] | undefined;
};

/** The file around one write, exactly as it was and is on disk (BOM included), for the history. */
export type WrittenFile = {
  readonly path: string;
  readonly before?: string | undefined;
  readonly after: string;
  readonly beforeHash?: string | undefined;
  readonly afterHash: string;
  readonly encoding?: 'base64' | undefined;
};

export interface SourceEditorService {
  getElement(projectRoot: string, loc: string): Promise<Result<ElementSource>>;
  getElementText(projectRoot: string, loc: string): Promise<Result<ElementText>>;
  /** Element tree of one JSX file for external AI agents (R-AG-19). */
  getPageTree(projectRoot: string, file: string, maxDepth?: number): Promise<Result<PageTree>>;
  /** Code and style files of the source folder for external AI agents (R-AG-19). */
  listFiles(projectRoot: string): Promise<Result<SourceFiles>>;
  /**
   * Applies one edit. `onWritten` runs inside the queue of the file, right after the write, so the
   * history records exactly the bytes this edit replaced, even when edits of the file overlap.
   */
  applyEdit(
    projectRoot: string,
    edit: SourceEdit,
    onWritten?: (file: WrittenFile) => void,
  ): Promise<Result<EditResult>>;
  applyStructureEdit(
    projectRoot: string,
    edit: StructureEdit,
    onWritten?: (files: readonly WrittenFile[]) => void,
  ): Promise<Result<StructureResult>>;
  applyEditBatch(
    projectRoot: string,
    edits: readonly AttributeLevelEdit[],
    onWritten?: (files: readonly WrittenFile[]) => void,
  ): Promise<Result<BatchEditResult>>;
}

async function executeGetElement(
  deps: SourceEditorDeps,
  projectRoot: string,
  loc: string,
  sourceDir: string,
  sourceExtensions: readonly string[],
): Promise<Result<ElementSource>> {
  const valRes = validateLocAndExt(loc, sourceDir, sourceExtensions);
  if (!valRes.ok) return valRes;

  const { rel, line, column } = valRes.value;
  const readRes = await deps.fs.readText(projectRoot, rel, {
    maxBytes: MAX_FILE_SIZE,
    keepBom: true,
  });
  if (!readRes.ok) {
    if (readRes.error.params?.['reason'] === 'tooLarge') {
      return ok({
        loc,
        tag: 'div',
        fileHash: '',
        readonly: 'tooLarge',
        className: { kind: 'none' },
        text: { kind: 'none' },
        attributes: {},
        inLoop: false,
      });
    }
    return readRes;
  }

  const rawContent = readRes.value;
  const { hasBom } = detectFormat(rawContent);
  const code = hasBom ? rawContent.slice(1) : rawContent;
  const fileHash = computeSha256(rawContent);

  const ast = getCachedAst(rel, code, fileHash);
  const targetNode = findNodeAt(ast, line, column);
  if (!targetNode) return err({ code: 'E017', params: { loc, reason: 'moved' } });

  return ok(buildElementSource(loc, targetNode, code, fileHash, ast));
}

type TargetNodeContext = {
  readonly rawContent: string;
  readonly code: string;
  readonly fileHash: string;
  readonly hasBom: boolean;
  readonly newline: '\r\n' | '\n';
  readonly ast: AstNode;
  readonly targetNode: AstNode;
  readonly opening: AstNode;
};

async function readAndResolveTargetNode(
  deps: SourceEditorDeps,
  projectRoot: string,
  rel: string,
  line: number,
  column: number,
  edit: SourceEdit,
): Promise<Result<TargetNodeContext>> {
  const readRes = await deps.fs.readText(projectRoot, rel, {
    maxBytes: MAX_FILE_SIZE,
    keepBom: true,
  });
  if (!readRes.ok) {
    if (readRes.error.params?.['reason'] === 'tooLarge') {
      return err({ code: 'E023', params: { file: rel, reason: 'tooLarge' } });
    }
    return readRes;
  }

  const rawContent = readRes.value;
  const { hasBom, newline } = detectFormat(rawContent);
  const code = hasBom ? rawContent.slice(1) : rawContent;
  const fileHash = computeSha256(rawContent);

  const ast = getCachedAst(rel, code, fileHash);
  const targetNode = findNodeAt(ast, line, column);
  if (!targetNode) return err({ code: 'E017', params: { loc: edit.loc, reason: 'moved' } });

  const opening = asAstNode(targetNode['openingElement']) ?? { type: 'JSXOpeningElement' };
  if (getJsxTagName(opening) !== edit.tag) {
    return err({ code: 'E017', params: { loc: edit.loc, reason: 'moved' } });
  }

  return ok({ rawContent, code, fileHash, hasBom, newline, ast, targetNode, opening });
}

async function writeMutatedFile(
  deps: SourceEditorDeps,
  projectRoot: string,
  rel: string,
  modifiedCode: string,
  hasBom: boolean,
  nextAst: AstNode,
): Promise<Result<{ readonly content: string; readonly hash: string }>> {
  const finalContent = hasBom ? `\uFEFF${modifiedCode}` : modifiedCode;
  const writeRes = await deps.fs.writeTextAtomic(projectRoot, rel, finalContent);
  if (!writeRes.ok) return writeRes;

  const nextHash = computeSha256(finalContent);
  cacheAst(rel, modifiedCode, nextHash, nextAst);
  return ok({ content: finalContent, hash: nextHash });
}

async function performEditOnFile(
  deps: SourceEditorDeps,
  projectRoot: string,
  rel: string,
  position: { readonly line: number; readonly column: number },
  edit: SourceEdit,
  onWritten?: (file: WrittenFile) => void,
): Promise<Result<EditResult>> {
  const { line, column } = position;
  const targetRes = await readAndResolveTargetNode(deps, projectRoot, rel, line, column, edit);
  if (!targetRes.ok) return targetRes;

  const { rawContent, code, fileHash, hasBom, newline, ast, targetNode, opening } = targetRes.value;
  const s = new MagicString(code);
  const mutateRes = executeEditMutation(edit, targetNode, opening, code, s, newline);
  if (!mutateRes.ok) return mutateRes;
  if (mutateRes.value.unchanged) {
    const el = buildElementSource(edit.loc, targetNode, code, fileHash, ast);
    return ok({ changed: false, file: rel, fileHash, element: el });
  }

  const modifiedCode = s.toString();
  const nextAstRes = parseModifiedCode(modifiedCode);
  if (!nextAstRes.ok) return nextAstRes;
  const nextAst = nextAstRes.value;

  const writeRes = await writeMutatedFile(deps, projectRoot, rel, modifiedCode, hasBom, nextAst);
  if (!writeRes.ok) return writeRes;
  const nextHash = writeRes.value.hash;
  onWritten?.({
    path: rel,
    before: rawContent,
    after: writeRes.value.content,
    beforeHash: fileHash,
    afterHash: nextHash,
  });

  const updatedNode = findNodeAt(nextAst, line, column) ?? targetNode;
  const nextElement = buildElementSource(edit.loc, updatedNode, modifiedCode, nextHash, nextAst);

  return ok({ changed: true, file: rel, fileHash: nextHash, element: nextElement });
}

async function executeGetElementText(
  deps: SourceEditorDeps,
  projectRoot: string,
  loc: string,
  sourceDir: string,
  sourceExtensions: readonly string[],
): Promise<Result<ElementText>> {
  const valRes = validateLocAndExt(loc, sourceDir, sourceExtensions);
  if (!valRes.ok) return valRes;

  const { rel, line, column } = valRes.value;
  const readRes = await deps.fs.readText(projectRoot, rel, {
    maxBytes: MAX_FILE_SIZE,
    keepBom: true,
  });
  if (!readRes.ok) {
    if (readRes.error.params?.['reason'] === 'tooLarge') {
      return err({ code: 'E023', params: { file: rel, reason: 'tooLarge' } });
    }
    return readRes;
  }

  const rawContent = readRes.value;
  const { hasBom } = detectFormat(rawContent);
  const code = hasBom ? rawContent.slice(1) : rawContent;
  const fileHash = computeSha256(rawContent);
  const ast = getCachedAst(rel, code, fileHash);

  return getElementTextFromAst(code, ast, rel, line, column);
}

/** R-SE-14: replaces the usages of the enclosing component by its count over the project. */
async function withUsages(
  usageCounter: UsageCounter,
  sourceDir: string,
  projectRoot: string,
  element: ElementSource,
): Promise<ElementSource> {
  const file = parseLocString(element.loc)?.file;
  if (element.component === undefined || file === undefined) return element;
  const { name } = element.component;
  const usages = await usageCounter.count(projectRoot, sourceDir, file, name);
  return { ...element, component: { name, usages } };
}

export function createSourceEditorService(
  deps: SourceEditorDeps,
  config: SourceEditorConfig = {},
): SourceEditorService {
  const sourceDir = config.sourceDir ?? 'src';
  const sourceExtensions = config.sourceExtensions ?? ['.jsx', '.tsx'];
  const usageCounter = deps.usageCounter ?? createUsageCounter(deps.fs);
  const formatSnippet = deps.formatSnippet ?? createSnippetFormatter({ fs: deps.fs });

  return {
    async getElement(projectRoot, loc) {
      const found = await executeGetElement(deps, projectRoot, loc, sourceDir, sourceExtensions);
      if (!found.ok) return found;
      return ok(await withUsages(usageCounter, sourceDir, projectRoot, found.value));
    },
    getElementText(projectRoot, loc) {
      return executeGetElementText(deps, projectRoot, loc, sourceDir, sourceExtensions);
    },
    getPageTree(projectRoot, file, maxDepth) {
      return readPageTree(deps.fs, projectRoot, file, { sourceDir, sourceExtensions, maxDepth });
    },
    listFiles(projectRoot) {
      return listSourceFiles(deps.fs, projectRoot, sourceDir);
    },
    async applyEdit(projectRoot, edit, onWritten) {
      const valRes = validateLocAndExt(edit.loc, sourceDir, sourceExtensions);
      if (!valRes.ok) return valRes;

      const { rel, line, column } = valRes.value;
      const edited = await queueFileTask(fileQueueKey(projectRoot, rel), () =>
        performEditOnFile(deps, projectRoot, rel, { line, column }, edit, onWritten),
      );
      if (!edited.ok) return edited;
      const element = await withUsages(usageCounter, sourceDir, projectRoot, edited.value.element);
      return ok({ ...edited.value, element });
    },
    applyStructureEdit(projectRoot, edit, onWritten) {
      return executeStructureEdit(
        deps.fs,
        projectRoot,
        sourceDir,
        sourceExtensions,
        edit,
        onWritten,
        formatSnippet,
      );
    },
    applyEditBatch(projectRoot, edits, onWritten) {
      return executeEditBatch(deps.fs, projectRoot, sourceDir, sourceExtensions, edits, onWritten);
    },
  };
}
