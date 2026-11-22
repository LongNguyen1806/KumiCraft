// SelectGroup structure operations: makeSelectGroup, linkSelectContent, removeSelectGroup (K9.8-1 TK-73).
import type {
  InteractionResult,
  MakeSelectGroupAction,
  Result,
  StylingReport,
} from '@kumicraft/shared';
import { err, ok, parseLocString } from '@kumicraft/shared';

import type { WrittenFile } from '../../../../kernel/editing.ts';
import type { InteractionOpsDeps } from '../../../../kernel/features.ts';
import { commitFileChanges } from '../../../../kernel/file-writer.ts';
import type { AstNode } from '../../../../lib/ast-helpers.ts';
import {
  asAstNode,
  detectFormat,
  getJsxTagName,
  parseJsxAst,
} from '../../../../lib/ast-helpers.ts';
import type { FileSystemPort } from '../../../../ports/file-system-port.ts';
import { checkInLoop } from '../component-analyzer.ts';
import { cacheAst, computeSha256, findNodeAt } from '../source-editor-lookup.ts';
import { buildMissingImportsEdits } from './imports.ts';
import { commitKitFiles, prepareKitPlan } from './kit-service.ts';
import { splitCssSelectClasses } from './select-group-css.ts';
import {
  buildSelectItemJsx,
  readAttrsExcluding,
  readElementStaticClassName,
  splitTailwindSelectClasses,
} from './select-group-helpers.ts';
import { findAncestors } from './structure-guard.ts';
import { fileIndentUnit, indentOf } from './structure-ops.ts';
import { applyTextEdits, type TextEdit } from './text-edits.ts';

export type ParsedSourceFile = {
  readonly file: string;
  readonly rawContent: string;
  readonly hasBom: boolean;
  readonly newline: '\r\n' | '\n';
  readonly code: string;
  readonly ast: AstNode;
};

type ResolvedAstEl = {
  readonly node: AstNode;
  readonly parent: AstNode;
  readonly opening: AstNode;
  readonly tag: string;
  readonly start: number;
  readonly end: number;
  readonly line: number;
};

export async function readParsedJsx(
  fs: FileSystemPort,
  root: string,
  file: string,
): Promise<Result<ParsedSourceFile>> {
  const readRes = await fs.readText(root, file, { maxBytes: 1024 * 1024, keepBom: true });
  if (!readRes.ok) return readRes;
  const rawContent = readRes.value;
  const { hasBom, newline } = detectFormat(rawContent);
  const code = hasBom ? rawContent.slice(1) : rawContent;
  try {
    return ok({ file, rawContent, hasBom, newline, code, ast: parseJsxAst(code) });
  } catch {
    return err({ code: 'E024', params: { reason: 'jsxParse' } });
  }
}

export async function writeWithKitAndNotify(options: {
  readonly deps: InteractionOpsDeps;
  readonly root: string;
  readonly parsed: ParsedSourceFile;
  readonly edits: readonly TextEdit[];
  readonly kitComponents: readonly ('SelectGroup' | 'SelectItem' | 'SelectPanel')[];
  readonly extraWritten?: readonly WrittenFile[] | undefined;
  readonly historyKey: string;
}): Promise<Result<readonly WrittenFile[]>> {
  const { deps, root, parsed, edits, kitComponents, extraWritten, historyKey } = options;
  const srcDir = deps.sourceDir ?? (parsed.file.startsWith('src/') ? 'src' : '');
  const kitPlan = await prepareKitPlan(deps.fs, root, srcDir, parsed.file, kitComponents);
  const importEdits = buildMissingImportsEdits(
    parsed.ast,
    parsed.code,
    parsed.file,
    kitComponents,
    { file: parsed.file, imports: kitPlan.imports },
    parsed.newline,
  );
  const applied = applyTextEdits(parsed.code, [...edits, ...importEdits.edits]);
  if (!applied.ok) return applied;
  const nextCode = applied.value.code;
  let nextAst: AstNode;
  try {
    nextAst = parseJsxAst(nextCode);
  } catch {
    return err({ code: 'E024', params: { reason: 'jsxParse' } });
  }
  const kitRes = await commitKitFiles(deps.fs, root, kitPlan.filesToCreate);
  if (!kitRes.ok) return kitRes;
  const finalText = parsed.hasBom ? `\uFEFF${nextCode}` : nextCode;
  const writeMain = await commitFileChanges({ fs: deps.fs }, root, [
    { path: parsed.file, before: parsed.rawContent, after: finalText },
  ]);
  if (!writeMain.ok) return writeMain;
  const nextHash = computeSha256(finalText);
  cacheAst(parsed.file, nextCode, nextHash, nextAst);
  const mainWritten: WrittenFile = {
    path: parsed.file,
    before: parsed.rawContent,
    after: finalText,
    beforeHash: computeSha256(parsed.rawContent),
    afterHash: nextHash,
  };
  const allWritten = [...kitRes.value, ...(extraWritten ?? []), mainWritten];
  deps.onWritten?.(allWritten, historyKey, 'SelectGroup');
  return ok(allWritten);
}

function resolveElsInSameFile(
  ast: AstNode,
  guards: readonly { readonly loc: string; readonly tag: string }[],
): Result<{ readonly file: string; readonly items: readonly ResolvedAstEl[] }> {
  const firstParsed = parseLocString(guards[0]?.loc ?? '');
  if (firstParsed === undefined) return err({ code: 'E017', params: { reason: 'invalidLoc' } });
  const resolved: ResolvedAstEl[] = [];
  for (const g of guards) {
    const loc = parseLocString(g.loc);
    if (loc === undefined || loc.file !== firstParsed.file) {
      return err({ code: 'E023', params: { reason: 'differentFiles' } });
    }
    const node = findNodeAt(ast, loc.line, loc.column);
    const opening = node !== undefined ? asAstNode(node['openingElement']) : undefined;
    const tag = opening !== undefined ? getJsxTagName(opening) : undefined;
    if (!node || !opening || node.start === undefined || node.end === undefined || tag !== g.tag) {
      return err({ code: 'E017', params: { loc: g.loc, reason: 'moved' } });
    }
    if (checkInLoop(ast, node)) return err({ code: 'E023', params: { reason: 'insideLoop' } });
    const parent = findAncestors(ast, node).at(-1);
    if (parent === undefined) return err({ code: 'E023', params: { reason: 'differentParents' } });
    resolved.push({ node, parent, opening, tag, start: node.start, end: node.end, line: loc.line });
  }
  resolved.sort((a, b) => a.start - b.start);
  const firstParent = resolved[0]?.parent;
  if (resolved.some((r) => r.parent !== firstParent)) {
    return err({ code: 'E023', params: { reason: 'differentParents' } });
  }
  return ok({ file: firstParsed.file, items: resolved });
}

function hasInterveningElement(
  parent: AstNode,
  firstStart: number,
  lastEnd: number,
  selected: readonly AstNode[],
): boolean {
  const children = Array.isArray(parent['children']) ? parent['children'] : [];
  return children.some((raw: unknown) => {
    const child = asAstNode(raw);
    return (
      child?.type === 'JSXElement' &&
      child.start !== undefined &&
      child.end !== undefined &&
      child.start >= firstStart &&
      child.end <= lastEnd &&
      !selected.includes(child)
    );
  });
}

function resolveUseTailwind(action: MakeSelectGroupAction, styling?: StylingReport): boolean {
  if (action.styleSystem !== undefined) {
    return action.styleSystem === 'tailwind3' || action.styleSystem === 'tailwind4';
  }
  return styling?.primary === 'tailwind';
}

async function computeSelectSplit(
  deps: InteractionOpsDeps,
  root: string,
  parsed: ParsedSourceFile,
  items: readonly ResolvedAstEl[],
  useTailwind: boolean,
): Promise<
  Result<{
    readonly perItem: readonly string[];
    readonly selectedClasses: readonly (string | undefined)[];
    readonly extraFiles: readonly WrittenFile[];
  }>
> {
  const classList: string[] = [];
  for (const item of items) {
    const cls = readElementStaticClassName(item.node, parsed.code);
    if (!cls.ok) return cls;
    classList.push(cls.value);
  }
  if (useTailwind) {
    return ok({
      perItem: splitTailwindSelectClasses(classList),
      selectedClasses: items.map(() => undefined),
      extraFiles: [],
    });
  }
  const split = await splitCssSelectClasses({
    fs: deps.fs,
    root,
    jsxFile: parsed.file,
    jsxCode: parsed.code,
    classNames: classList,
    styling: deps.styling,
  });
  return ok({
    perItem: split.perItemClassName,
    selectedClasses: split.selectedClassNames,
    extraFiles: split.writtenCssFiles,
  });
}

function buildWrappedGroupCode(
  parsed: ParsedSourceFile,
  items: readonly ResolvedAstEl[],
  perItemClasses: readonly string[],
  selectedClassNames: readonly (string | undefined)[],
  mode: 'single' | 'multiple',
): { readonly wrappedText: string; readonly itemValues: readonly string[] } {
  const firstItem = items[0];
  const baseIndent = indentOf(parsed.code, firstItem?.start ?? 0);
  const childIndent = `${baseIndent}${fileIndentUnit(parsed.code, firstItem?.line ?? 1)}`;
  const itemValues = items.map((_, idx) => `item-${String(idx + 1)}`);
  const rebuilt = items.map((item, idx) => {
    const otherAttrs = readAttrsExcluding(item.opening, parsed.code, new Set(['className']));
    const closing = asAstNode(item.node['closingElement']);
    const childrenCode =
      item.opening['selfClosing'] === true
        ? undefined
        : parsed.code.slice(item.opening.end ?? item.start, closing?.start ?? item.end);
    const jsx = buildSelectItemJsx({
      originalTag: item.tag,
      value: itemValues[idx] ?? `item-${String(idx + 1)}`,
      className: perItemClasses[idx] ?? '',
      selectedClassName: selectedClassNames[idx],
      otherAttrs,
      childrenCode,
    });
    return `${idx === 0 ? childIndent : indentOf(parsed.code, item.start)}${jsx}`;
  });
  const body = `<SelectGroup defaultValue="${itemValues[0] ?? 'item-1'}" mode="${mode}">${parsed.newline}${rebuilt.join(parsed.newline)}${parsed.newline}${baseIndent}</SelectGroup>`;
  return { wrappedText: body, itemValues };
}

/** The chosen elements, side by side under one parent with nothing else between them. */
function resolveGroupItems(ast: AstNode, elements: MakeSelectGroupAction['elements']) {
  const resolvedRes = resolveElsInSameFile(ast, elements);
  if (!resolvedRes.ok) return resolvedRes;
  const items = resolvedRes.value.items;
  const firstItem = items[0];
  const lastItem = items[items.length - 1];
  if (!firstItem || !lastItem) return err({ code: 'E016', params: { reason: 'emptyElements' } });
  const nodes = items.map((i) => i.node);
  if (hasInterveningElement(firstItem.parent, firstItem.start, lastItem.end, nodes)) {
    return err({ code: 'E023', params: { reason: 'differentParents' } });
  }
  return ok({ items, firstItem, lastItem });
}

export async function applyMakeSelectGroup(
  deps: InteractionOpsDeps,
  root: string,
  action: MakeSelectGroupAction,
): Promise<Result<InteractionResult>> {
  const firstLoc = parseLocString(action.elements[0]?.loc ?? '');
  if (firstLoc === undefined) return err({ code: 'E016', params: { reason: 'invalidLoc' } });
  const loaded = await readParsedJsx(deps.fs, root, firstLoc.file);
  if (!loaded.ok) return loaded;
  const resolved = resolveGroupItems(loaded.value.ast, action.elements);
  if (!resolved.ok) return resolved;
  const { items, firstItem, lastItem } = resolved.value;
  const split = await computeSelectSplit(
    deps,
    root,
    loaded.value,
    items,
    resolveUseTailwind(action, deps.styling),
  );
  if (!split.ok) return split;
  const { wrappedText, itemValues } = buildWrappedGroupCode(
    loaded.value,
    items,
    split.value.perItem,
    split.value.selectedClasses,
    action.mode,
  );
  const written = await writeWithKitAndNotify({
    deps,
    root,
    parsed: loaded.value,
    edits: [{ start: firstItem.start, end: lastItem.end, text: wrappedText }],
    kitComponents: ['SelectGroup', 'SelectItem'],
    extraWritten: split.value.extraFiles,
    historyKey: 'history:makeSelectGroup',
  });
  if (!written.ok) return written;
  return ok({
    changed: true,
    files: written.value.map((f) => f.path),
    locs: [action.elements[0]?.loc ?? ''],
    itemValues: [...itemValues],
  });
}

export type { InteractionOpsDeps };
