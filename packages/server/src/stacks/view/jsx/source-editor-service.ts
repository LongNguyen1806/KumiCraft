// Source Editor Service implementing M-SE (SPEC-03 section 5.5, SPEC-04 section 6).
import type { EditResult, ElementSource, ElementText, Result, SourceEdit } from '@kumicraft/shared';
import { err, ok, parseLocString } from '@kumicraft/shared';
import MagicString from 'magic-string';

import type { SourceEditorService, WrittenFile } from '../../../kernel/editing.ts';
import { fileQueueKey, queueFileTask } from '../../../kernel/file-queue.ts';
import { commitFileChanges } from '../../../kernel/file-writer.ts';
import type { AstNode } from '../../../lib/ast-helpers.ts';
import { asAstNode, detectFormat, getJsxTagName } from '../../../lib/ast-helpers.ts';
import { createUsageCounter, type UsageCounter } from './component-usages.ts';
import { executeEditMutation, parseModifiedCode } from './edit-mutations.ts';
import { createEditorMutations, resolveSourcePaths } from './editor-mutations.ts';
import { readPageTree } from './page-tree.ts';
import { createSnippetFormatter } from './snippet-format.ts';
import {
  buildElementSource,
  cacheAst,
  computeSha256,
  findNodeAt,
  getCachedAst,
  validateLocAndExt,
} from './source-editor-lookup.ts';
import type { SourceEditorConfig, SourceEditorDeps } from './source-editor-types.ts';
import { listSourceFiles } from './source-files.ts';
import { readDataContextForNode } from './structure/data-ops.ts';
import { getElementTextFromAst } from './structure/element-text.ts';

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB (R-SE-01)

function buildMarkupOnlyElement(loc: string, rawContent: string, line: number): ElementSource {
  const fileHash = computeSha256(rawContent);
  const lines = rawContent.split(/\r?\n/);
  const lineText = lines[line - 1] ?? '';
  const match = lineText.trim().match(/^([a-zA-Z0-9_-]+)/);
  const tag = match && match[1] !== undefined ? match[1] : 'div';
  return {
    loc,
    tag,
    fileHash,
    readonly: 'outsideSource',
    className: { kind: 'none' },
    text: { kind: 'none' },
    attributes: {},
    inLoop: false,
  };
}

async function executeGetElement(
  deps: SourceEditorDeps,
  projectRoot: string,
  loc: string,
  sourceDir: string,
  markupExtensions: readonly string[],
  sourceExtensions: readonly string[],
): Promise<Result<ElementSource>> {
  const valRes = validateLocAndExt(loc, sourceDir, markupExtensions);
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
  if (!sourceExtensions.some((ext) => rel.endsWith(ext))) {
    return ok(buildMarkupOnlyElement(loc, rawContent, line));
  }

  const { hasBom } = detectFormat(rawContent);
  const code = hasBom ? rawContent.slice(1) : rawContent;
  const fileHash = computeSha256(rawContent);

  const ast = getCachedAst(rel, code, fileHash);
  const targetNode = findNodeAt(ast, line, column);
  if (!targetNode) return err({ code: 'E017', params: { loc, reason: 'moved' } });

  const element = buildElementSource(loc, targetNode, code, fileHash, ast);
  if (!element.inLoop) return ok(element);
  const dataContext = await readDataContextForNode(deps.fs, projectRoot, rel, ast, targetNode);
  return ok(dataContext ? { ...element, dataContext } : element);
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
  file: { readonly before: string; readonly modifiedCode: string; readonly hasBom: boolean },
  nextAst: AstNode,
): Promise<Result<{ readonly content: string; readonly hash: string }>> {
  const { before, modifiedCode, hasBom } = file;
  const finalContent = hasBom ? `\uFEFF${modifiedCode}` : modifiedCode;
  const writeRes = await commitFileChanges({ fs: deps.fs }, projectRoot, [
    { path: rel, before, after: finalContent },
  ]);
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

  const writeRes = await writeMutatedFile(
    deps,
    projectRoot,
    rel,
    { before: rawContent, modifiedCode, hasBom },
    nextAst,
  );
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
  markupExtensions: readonly string[],
  sourceExtensions: readonly string[],
): Promise<Result<ElementText>> {
  const valRes = validateLocAndExt(loc, sourceDir, markupExtensions);
  if (!valRes.ok) return valRes;

  const { rel, line, column } = valRes.value;
  if (!sourceExtensions.some((ext) => rel.endsWith(ext))) {
    return ok({ jsx: '', file: rel, imports: [] });
  }

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

async function executeApplyEdit(
  deps: SourceEditorDeps,
  usageCounter: UsageCounter,
  sourceDir: string,
  sourceExtensions: readonly string[],
  projectRoot: string,
  edit: SourceEdit,
  onWritten?: (file: WrittenFile) => void,
): Promise<Result<EditResult>> {
  const valRes = validateLocAndExt(edit.loc, sourceDir, sourceExtensions);
  if (!valRes.ok) return valRes;
  const { rel, line, column } = valRes.value;
  const edited = await queueFileTask(fileQueueKey(projectRoot, rel), () =>
    performEditOnFile(deps, projectRoot, rel, { line, column }, edit, onWritten),
  );
  if (!edited.ok) return edited;
  const element = await withUsages(usageCounter, sourceDir, projectRoot, edited.value.element);
  return ok({ ...edited.value, element });
}

export function createSourceEditorService(
  deps: SourceEditorDeps,
  config: SourceEditorConfig = {},
): SourceEditorService {
  const paths = resolveSourcePaths(deps, config);
  const usageCounter = deps.usageCounter ?? createUsageCounter(deps.fs);
  const formatSnippet = deps.formatSnippet ?? createSnippetFormatter({ fs: deps.fs });
  const mutations = createEditorMutations(deps, paths, formatSnippet, (root, edit, cb) =>
    executeApplyEdit(
      deps,
      usageCounter,
      paths.getSourceDir(),
      paths.getSourceExtensions(),
      root,
      edit,
      cb,
    ),
  );

  return {
    async getElement(projectRoot, loc) {
      const sDir = paths.getSourceDir();
      const found = await executeGetElement(
        deps,
        projectRoot,
        loc,
        sDir,
        paths.getMarkupExtensions(),
        paths.getSourceExtensions(),
      );
      return found.ok ? ok(await withUsages(usageCounter, sDir, projectRoot, found.value)) : found;
    },
    getElementText: (root, loc) =>
      executeGetElementText(
        deps,
        root,
        loc,
        paths.getSourceDir(),
        paths.getMarkupExtensions(),
        paths.getSourceExtensions(),
      ),
    getPageTree: (root, file, maxDepth) =>
      readPageTree(deps.fs, root, file, {
        sourceDir: paths.getSourceDir(),
        sourceExtensions: paths.getSourceExtensions(),
        maxDepth,
      }),
    listFiles: (root) => listSourceFiles(deps.fs, root, paths.getSourceDir()),
    ...mutations,
  };
}

export type { SourceEditorService, WrittenFile };
export type { SourceEditorConfig, SourceEditorDeps };
