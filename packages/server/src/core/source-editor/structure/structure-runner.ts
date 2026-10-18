// Multi-file coordinator for structural JSX edits (SPEC-04 section 14, R-SE-29).
import type { ElementGuard, Result, StructureEdit, StructureResult } from '@reactcraft/shared';
import { err, ok } from '@reactcraft/shared';

import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { type AstNode, detectFormat, parseJsxAst } from '../ast-helpers.ts';
import { commitPreparedFiles, type PreparedFileWrite, withFileLocks } from '../file-commit.ts';
import { computeSha256, getCachedAst } from '../source-editor-lookup.ts';
import type { WrittenFile } from '../source-editor-service.ts';
import {
  collectComponentTags,
  collectMatchingImportStatements,
  extractElementText,
} from './element-text.ts';
import { type ResolvedElement, validateInsertedJsx } from './structure-ops.ts';
import {
  type FilePlanResult,
  type GuardWithPosition,
  type PlanContext,
  planFileEdits,
  resolveElementsInAst,
  validateGuards,
} from './structure-plan.ts';
import { applyTextEdits } from './text-edits.ts';

const MAX_FILE_SIZE = 1024 * 1024;

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

type FileContext = {
  readonly rawBefore: string;
  readonly code: string;
  readonly hasBom: boolean;
  readonly newline: '\r\n' | '\n';
  readonly beforeHash: string;
  readonly ast: AstNode;
  readonly resolved: readonly ResolvedElement[];
};

async function loadFileContext(
  fs: FileSystemPort,
  projectRoot: string,
  rel: string,
  guards: readonly GuardWithPosition[],
): Promise<Result<FileContext>> {
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

  return ok({
    rawBefore,
    code,
    hasBom,
    newline,
    beforeHash,
    ast,
    resolved: resolvedRes.value,
  });
}

function collectGuardsForEdit(edit: StructureEdit): readonly ElementGuard[] {
  if (edit.kind === 'insert') {
    return [edit.target.kind === 'sibling' ? edit.target.ref : edit.target.parent];
  }
  if (edit.kind === 'move') {
    const targetGuard = edit.target.kind === 'sibling' ? edit.target.ref : edit.target.parent;
    return [...edit.elements, targetGuard];
  }
  if (edit.kind === 'unwrap') {
    return [edit.element];
  }
  return edit.elements;
}

type CrossFileInfo = {
  readonly movingJsx?: string | undefined;
  readonly sourceFile?: string | undefined;
  readonly sourceImports?: readonly string[] | undefined;
  readonly movingTags?: readonly string[] | undefined;
  readonly targetResolved?: ResolvedElement | undefined;
};

function computeCrossFileInfo(
  edit: StructureEdit,
  validatedGuards: readonly GuardWithPosition[],
  targetGuard: GuardWithPosition | undefined,
  contexts: ReadonlyMap<string, FileContext>,
): CrossFileInfo {
  if (!targetGuard) return {};
  const targetCtx = contexts.get(targetGuard.rel);
  const targetResolved = targetCtx?.resolved.find((r) => r.loc === targetGuard.loc);

  if (edit.kind !== 'move') return { targetResolved };

  const sourceGuard = validatedGuards[0];
  if (!sourceGuard || sourceGuard.rel === targetGuard.rel) return { targetResolved };

  const sourceFile = sourceGuard.rel;
  const sourceCtx = contexts.get(sourceFile);
  if (!sourceCtx) return { targetResolved };

  const moveElements = sourceCtx.resolved.filter((r) =>
    edit.elements.some((eg) => eg.loc === r.loc),
  );
  const movingJsx = moveElements
    .map((el) => extractElementText(sourceCtx.code, el))
    .join(sourceCtx.newline);

  const allTags = new Set<string>();
  for (const el of moveElements) {
    for (const tag of collectComponentTags(el.node)) allTags.add(tag);
  }
  const movingTags = [...allTags];
  const sourceImports = collectMatchingImportStatements(sourceCtx.ast, sourceCtx.code, movingTags);

  return {
    movingJsx,
    sourceFile,
    sourceImports,
    movingTags,
    targetResolved,
  };
}

function filterRelevantElements(
  edit: StructureEdit,
  resolved: readonly ResolvedElement[],
  targetLoc?: string,
): readonly ResolvedElement[] {
  return resolved.filter((r) => {
    if (edit.kind === 'insert') return r.loc === targetLoc;
    if (edit.kind === 'move') {
      return edit.elements.some((eg) => eg.loc === r.loc) || r.loc === targetLoc;
    }
    if (edit.kind === 'unwrap') return r.loc === edit.element.loc;
    return edit.elements.some((eg) => eg.loc === r.loc);
  });
}

function processSingleFilePlan(
  rel: string,
  ctx: FileContext,
  plan: FilePlanResult,
): Result<PreparedFileWrite | undefined> {
  if (plan.edits.length === 0) return ok(undefined);

  const appliedRes = applyTextEdits(ctx.code, plan.edits);
  if (!appliedRes.ok) return appliedRes;

  const { code: modifiedCode, marks } = appliedRes.value;
  if (modifiedCode === ctx.code) return ok(undefined);

  const nextAstRes = parseModifiedAst(modifiedCode);
  if (!nextAstRes.ok) return nextAstRes;

  const finalContent = ctx.hasBom ? `\uFEFF${modifiedCode}` : modifiedCode;
  const locs = plan.locsFromMarks
    ? marks.map((offset) => offsetToLoc(rel, modifiedCode, offset))
    : [];

  return ok({
    rel,
    rawBefore: ctx.rawBefore,
    beforeHash: ctx.beforeHash,
    modifiedCode,
    finalContent,
    nextAst: nextAstRes.value,
    locs,
    warnings: plan.warnings ?? [],
  });
}

async function loadAllContexts(
  fs: FileSystemPort,
  projectRoot: string,
  sortedFiles: readonly string[],
  byFile: ReadonlyMap<string, GuardWithPosition[]>,
): Promise<Result<ReadonlyMap<string, FileContext>>> {
  const contexts = new Map<string, FileContext>();
  for (const rel of sortedFiles) {
    const guards = byFile.get(rel) ?? [];
    const ctxRes = await loadFileContext(fs, projectRoot, rel, guards);
    if (!ctxRes.ok) return ctxRes;
    contexts.set(rel, ctxRes.value);
  }
  return ok(contexts);
}

async function performLockedStructureEdit(
  fs: FileSystemPort,
  projectRoot: string,
  sortedFiles: readonly string[],
  byFile: ReadonlyMap<string, GuardWithPosition[]>,
  edit: StructureEdit,
  targetGuard: GuardWithPosition | undefined,
  validatedGuards: readonly GuardWithPosition[],
  onWritten?: (files: readonly WrittenFile[]) => void,
): Promise<Result<StructureResult>> {
  const ctxsRes = await loadAllContexts(fs, projectRoot, sortedFiles, byFile);
  if (!ctxsRes.ok) return ctxsRes;
  const contexts = ctxsRes.value;

  const crossInfo = computeCrossFileInfo(edit, validatedGuards, targetGuard, contexts);
  const prepared: PreparedFileWrite[] = [];
  const allWarnings: string[] = [];

  for (const rel of sortedFiles) {
    const ctx = contexts.get(rel);
    if (!ctx) continue;

    const relevant = filterRelevantElements(edit, ctx.resolved, targetGuard?.loc);
    const moveInFile =
      edit.kind === 'move'
        ? relevant.filter((r) => edit.elements.some((eg) => eg.loc === r.loc))
        : relevant;

    const planCtx: PlanContext = {
      targetGuard,
      targetResolved: crossInfo.targetResolved,
      movingJsx: crossInfo.movingJsx,
      sourceFile: crossInfo.sourceFile,
      sourceImports: crossInfo.sourceImports,
      movingTags: crossInfo.movingTags,
    };

    const planRes = planFileEdits(edit, rel, ctx.ast, ctx.code, ctx.newline, moveInFile, planCtx);
    if (!planRes.ok) return planRes;
    if (planRes.value.warnings) allWarnings.push(...planRes.value.warnings);

    const prepRes = processSingleFilePlan(rel, ctx, planRes.value);
    if (!prepRes.ok) return prepRes;
    if (prepRes.value !== undefined) prepared.push(prepRes.value);
  }

  if (prepared.length === 0) return ok({ changed: false, files: [], locs: [] });

  const commitRes = await commitPreparedFiles(fs, projectRoot, prepared);
  if (!commitRes.ok) return commitRes;

  onWritten?.(commitRes.value);
  return ok({
    changed: true,
    files: prepared.map((p) => p.rel),
    locs: prepared.flatMap((p) => p.locs),
    ...(allWarnings.length > 0 ? { warnings: [...new Set(allWarnings)] } : {}),
  });
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

  const rawGuards = collectGuardsForEdit(edit);
  const valGuardsRes = validateGuards(rawGuards, sourceDir, sourceExtensions);
  if (!valGuardsRes.ok) return valGuardsRes;

  const validatedGuards = valGuardsRes.value;
  const targetGuard =
    edit.kind === 'insert' || edit.kind === 'move'
      ? validatedGuards[validatedGuards.length - 1]
      : undefined;

  const byFile = new Map<string, GuardWithPosition[]>();
  for (const g of validatedGuards) {
    const list = byFile.get(g.rel) ?? [];
    list.push(g);
    byFile.set(g.rel, list);
  }
  const sortedFiles = [...byFile.keys()].sort((a, b) => a.localeCompare(b));

  return withFileLocks(projectRoot, sortedFiles, () =>
    performLockedStructureEdit(
      fs,
      projectRoot,
      sortedFiles,
      byFile,
      edit,
      targetGuard,
      validatedGuards,
      onWritten,
    ),
  );
}
