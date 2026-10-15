// Source Editor Service implementing M-SE (SPEC-03 section 5.5, SPEC-04 section 6).
import { createHash } from 'node:crypto';
import * as path from 'node:path';

import type {
  EditResult,
  ElementSource,
  ElementText,
  Result,
  SetAttributeEdit,
  SetClassNameEdit,
  SetTextEdit,
  SourceEdit,
} from '@reactcraft/shared';
import { err, ok, parseLocString, relPathProblem } from '@reactcraft/shared';
import MagicString from 'magic-string';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { AstNode } from './ast-helpers.ts';
import { asAstNode, detectFormat, getJsxTagName, parseJsxAst } from './ast-helpers.ts';
import { readClassName, readEditableAttributes } from './attribute-reader.ts';
import { checkInLoop, findEnclosingComponent } from './component-analyzer.ts';
import { createUsageCounter } from './component-usages.ts';
import { fileQueueKey, queueFileTask } from './file-queue.ts';
import { mutateAttribute, mutateText } from './source-mutator.ts';
import { decodeHtmlEntities, normalizeJsxWhitespace } from './text-reader.ts';

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB (R-SE-01)

type AstCacheEntry = {
  readonly hash: string;
  readonly ast: AstNode;
  readonly code: string;
};

const astCache = new Map<string, AstCacheEntry>();

function getCachedAst(fileKey: string, code: string, hash: string): AstNode {
  const cached = astCache.get(fileKey);
  if (cached && cached.hash === hash) {
    return cached.ast;
  }
  const ast = parseJsxAst(code);
  if (astCache.size >= 50) {
    const firstKey = astCache.keys().next().value;
    if (firstKey !== undefined) astCache.delete(firstKey);
  }
  astCache.set(fileKey, { hash, ast, code });
  return ast;
}

export type SourceEditorDeps = {
  readonly fs: FileSystemPort;
};

export type SourceEditorConfig = {
  readonly sourceDir?: string | undefined;
  readonly sourceExtensions?: readonly string[] | undefined;
};

/** The file around one write, exactly as it was and is on disk (BOM included), for the history. */
export type WrittenFile = {
  readonly path: string;
  readonly before: string;
  readonly after: string;
  readonly beforeHash: string;
  readonly afterHash: string;
};

export interface SourceEditorService {
  getElement(projectRoot: string, loc: string): Promise<Result<ElementSource>>;
  /**
   * Applies one edit. `onWritten` runs inside the queue of the file, right after the write, so the
   * history records exactly the bytes this edit replaced, even when edits of the file overlap.
   */
  applyEdit(
    projectRoot: string,
    edit: SourceEdit,
    onWritten?: (file: WrittenFile) => void,
  ): Promise<Result<EditResult>>;
}

function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function findNodeAt(ast: AstNode, line: number, column: number): AstNode | undefined {
  let targetNode: AstNode | undefined;

  function walk(node: unknown) {
    const astN = asAstNode(node);
    if (!astN || targetNode) return;

    if (astN.type === 'JSXElement') {
      const opening = asAstNode(astN['openingElement']);
      const start = opening?.loc?.start;
      if (start && start.line === line && start.column + 1 === column) {
        targetNode = astN;
        return;
      }
    }

    for (const key of Object.keys(astN)) {
      if (key === 'loc' || key === 'comments' || key === 'tokens') continue;
      const child = astN[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item);
      } else if (child !== undefined && typeof child === 'object') {
        walk(child);
      }
    }
  }

  walk(ast['program']);
  return targetNode;
}

function parseText(children: readonly unknown[]): ElementText {
  if (children.length === 0) return { kind: 'static', value: '' };

  const astChildren = children.map(asAstNode).filter((c): c is AstNode => c !== undefined);
  const onlyText =
    astChildren.length === children.length && astChildren.every((c) => c.type === 'JSXText');
  if (onlyText) {
    const rawCombined = astChildren
      .map((c) => (typeof c['value'] === 'string' ? c['value'] : ''))
      .join('');
    const normalized = normalizeJsxWhitespace(rawCombined);
    return { kind: 'static', value: decodeHtmlEntities(normalized) };
  }

  if (astChildren.length === 1 && astChildren[0]?.type === 'JSXExpressionContainer') {
    const expr = asAstNode(astChildren[0]['expression']);
    return { kind: 'expression', code: typeof expr?.['name'] === 'string' ? expr['name'] : '' };
  }

  return { kind: 'mixed' as const };
}

function buildElementSource(
  loc: string,
  targetNode: AstNode,
  code: string,
  fileHash: string,
  ast: AstNode,
  readonlyReason?: 'outsideSource' | 'tooLarge',
): ElementSource {
  const opening = asAstNode(targetNode['openingElement']) ?? { type: 'JSXOpeningElement' };
  const tag = getJsxTagName(opening) ?? 'div';
  const isSelfClosing = Boolean(opening['selfClosing']);

  const rawAttrs = Array.isArray(opening['attributes']) ? opening['attributes'] : [];
  const rawChildren = Array.isArray(targetNode['children']) ? targetNode['children'] : [];

  const className = readClassName(rawAttrs, code);
  const text: ElementText = isSelfClosing ? { kind: 'selfClosing' } : parseText(rawChildren);
  const attributes = readEditableAttributes(rawAttrs, code);
  // Usages across the project are filled in by the service (R-SE-14); here only the name is known.
  const componentName = findEnclosingComponent(ast, targetNode);
  const inLoop = checkInLoop(ast, targetNode);

  return {
    loc,
    tag,
    fileHash,
    ...(readonlyReason !== undefined ? { readonly: readonlyReason } : {}),
    className,
    text,
    attributes,
    ...(componentName !== undefined ? { component: { name: componentName, usages: 1 } } : {}),
    inLoop,
  };
}

type FileValidation = {
  readonly rel: string;
  readonly line: number;
  readonly column: number;
};

function validateLocAndExt(
  loc: string,
  sourceDir: string,
  sourceExtensions: readonly string[],
): Result<FileValidation> {
  const parsed = parseLocString(loc);
  if (!parsed) return err({ code: 'E016', params: { loc } });

  const { file, line, column } = parsed;
  const relErr = relPathProblem(file);
  if (relErr !== undefined) return err({ code: 'E016', params: { file, reason: relErr } });

  const ext = path.extname(file);
  if (!sourceExtensions.includes(ext)) {
    return err({ code: 'E023', params: { file, reason: 'notJsxFile' } });
  }

  const normalizedSourceDir = sourceDir.replaceAll('\\', '/').replace(/\/+$/, '');
  if (!file.startsWith(`${normalizedSourceDir}/`) || file.includes('node_modules/')) {
    return err({ code: 'E023', params: { file, reason: 'outsideSource' } });
  }

  return ok({ rel: file, line, column });
}

function applyClassNameMutation(
  edit: SetClassNameEdit,
  rawAttrs: readonly unknown[],
  opening: AstNode,
  code: string,
  s: MagicString,
): Result<{ unchanged?: boolean }> {
  const currentClass = readClassName(rawAttrs, code);
  if (currentClass.kind === 'expression')
    return err({ code: 'E023', params: { reason: 'classExpression' } });
  if (currentClass.kind === 'duplicate')
    return err({ code: 'E023', params: { reason: 'duplicateAttr' } });
  const currentVal = currentClass.kind === 'static' ? currentClass.value : undefined;
  if (edit.before !== undefined && edit.before !== currentVal)
    return err({ code: 'E017', params: { reason: 'valueChanged' } });
  if (currentVal === edit.after) return ok({ unchanged: true });
  mutateAttribute(s, code, opening, 'className', edit.after);
  return ok({});
}

function applyAttributeMutation(
  edit: SetAttributeEdit,
  rawAttrs: readonly unknown[],
  opening: AstNode,
  code: string,
  s: MagicString,
): Result<{ unchanged?: boolean }> {
  const attrs = readEditableAttributes(rawAttrs, code);
  const currentAttr = attrs[edit.name];
  if (currentAttr?.kind === 'expression')
    return err({ code: 'E023', params: { reason: 'attrExpression' } });
  const currentVal = currentAttr?.kind === 'static' ? currentAttr.value : undefined;
  if (edit.before !== undefined && edit.before !== currentVal)
    return err({ code: 'E017', params: { reason: 'valueChanged' } });
  if (currentVal === edit.after) return ok({ unchanged: true });
  mutateAttribute(s, code, opening, edit.name, edit.after);
  return ok({});
}

function applyTextMutation(
  edit: SetTextEdit,
  targetNode: AstNode,
  opening: AstNode,
  code: string,
  s: MagicString,
  newline: '\r\n' | '\n',
): Result<{ unchanged?: boolean }> {
  if (opening['selfClosing']) return err({ code: 'E023', params: { reason: 'selfClosing' } });
  const rawChildren = Array.isArray(targetNode['children']) ? targetNode['children'] : [];
  const currentText = parseText(rawChildren);
  if (currentText.kind === 'expression')
    return err({ code: 'E023', params: { reason: 'textExpression' } });
  if (currentText.kind === 'mixed') return err({ code: 'E023', params: { reason: 'textMixed' } });
  const currentVal = currentText.kind === 'static' ? currentText.value : '';
  if (edit.before !== currentVal) return err({ code: 'E017', params: { reason: 'valueChanged' } });
  if (currentVal === edit.after) return ok({ unchanged: true });
  mutateText(s, code, targetNode, edit.after, newline);
  return ok({});
}

function executeEditMutation(
  edit: SourceEdit,
  targetNode: AstNode,
  opening: AstNode,
  code: string,
  s: MagicString,
  newline: '\r\n' | '\n',
): Result<{ unchanged?: boolean }> {
  const rawAttrs = Array.isArray(opening['attributes']) ? opening['attributes'] : [];
  if (edit.kind === 'setClassName') {
    return applyClassNameMutation(edit, rawAttrs, opening, code, s);
  }
  if (edit.kind === 'setAttribute') {
    return applyAttributeMutation(edit, rawAttrs, opening, code, s);
  }
  return applyTextMutation(edit, targetNode, opening, code, s, newline);
}

function parseModifiedCode(code: string): Result<AstNode> {
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
  astCache.set(rel, { hash: nextHash, ast: nextAst, code: modifiedCode });
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

export function createSourceEditorService(
  deps: SourceEditorDeps,
  config: SourceEditorConfig = {},
): SourceEditorService {
  const sourceDir = config.sourceDir ?? 'src';
  const sourceExtensions = config.sourceExtensions ?? ['.jsx', '.tsx'];
  const usageCounter = createUsageCounter(deps.fs);

  /** R-SE-14: replaces the usages of the enclosing component by its count over the project. */
  const withUsages = async (
    projectRoot: string,
    element: ElementSource,
  ): Promise<ElementSource> => {
    const file = parseLocString(element.loc)?.file;
    if (element.component === undefined || file === undefined) return element;
    const { name } = element.component;
    const usages = await usageCounter.count(projectRoot, sourceDir, file, name);
    return { ...element, component: { name, usages } };
  };

  return {
    async getElement(projectRoot, loc) {
      const found = await executeGetElement(deps, projectRoot, loc, sourceDir, sourceExtensions);
      return found.ok ? ok(await withUsages(projectRoot, found.value)) : found;
    },
    async applyEdit(projectRoot, edit, onWritten) {
      const valRes = validateLocAndExt(edit.loc, sourceDir, sourceExtensions);
      if (!valRes.ok) return valRes;

      const { rel, line, column } = valRes.value;
      const edited = await queueFileTask(fileQueueKey(projectRoot, rel), () =>
        performEditOnFile(deps, projectRoot, rel, { line, column }, edit, onWritten),
      );
      if (!edited.ok) return edited;
      return ok({ ...edited.value, element: await withUsages(projectRoot, edited.value.element) });
    },
  };
}
