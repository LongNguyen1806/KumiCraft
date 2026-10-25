// Renaming a page route, component name, and file (R-PG-14).
import * as path from 'node:path';

import {
  err,
  ok,
  type PageInfo,
  pageNames,
  type Result,
  type StructureResult,
} from '@kumicraft/shared';

import { computeSha256, type HistoryFileChange } from '../history/history-service.ts';
import { asAstNode, type AstNode, parseJsxAst } from '../source-editor/ast-helpers.ts';
import { applyTextEdits, type TextEdit } from '../source-editor/structure/text-edits.ts';
import {
  normalizeRoute,
  type PageEditDeps,
  renameComponentInPageCode,
  type RenamePageInput,
  routerNotSupportedError,
  validateRouteSyntax,
  withFileLocks,
} from './page-common.ts';
import { readPages } from './pages.ts';
import {
  findRouteNodes,
  findRouterArray,
  type FoundRouteNode,
  objectProps,
  stringOf,
} from './routes-ast.ts';
import { getJsxAttr, getJsxStringAttr } from './routes-jsx.ts';

function collectPathEdits(
  routesCode: string,
  routeNode: AstNode,
  oldPath: string,
  newPath: string | undefined,
): TextEdit[] {
  if (newPath === undefined || newPath === oldPath) return [];
  if (routeNode.type === 'JSXElement') {
    const pathAttr = getJsxAttr(routeNode, 'path');
    if (!pathAttr || typeof pathAttr.start !== 'number' || typeof pathAttr.end !== 'number') {
      return [];
    }
    const origRaw = getJsxStringAttr(routeNode, 'path');
    const isRel = origRaw !== undefined && !origRaw.startsWith('/');
    const replacement = isRel ? newPath.replace(/^\//, '') : newPath;
    const rawQuote = routesCode[pathAttr.start] === "'" ? "'" : '"';
    return [
      { start: pathAttr.start, end: pathAttr.end, text: `${rawQuote}${replacement}${rawQuote}` },
    ];
  }
  const pathProp = objectProps(routeNode).get('path');
  if (!pathProp || typeof pathProp.start !== 'number' || typeof pathProp.end !== 'number') {
    return [];
  }
  const origRaw = stringOf(pathProp);
  const isRel = origRaw !== undefined && !origRaw.startsWith('/');
  const rawQuote = routesCode[pathProp.start] === '"' ? '"' : "'";
  const rep = isRel
    ? `${rawQuote}${newPath.replace(/^\//, '')}${rawQuote}`
    : `${rawQuote}${newPath}${rawQuote}`;
  return [{ start: pathProp.start, end: pathProp.end, text: rep }];
}

function collectImportRenameEdits(
  routesCode: string,
  routesAst: AstNode,
  oldComp: string,
  newComp: string,
): TextEdit[] {
  const edits: TextEdit[] = [];
  const program = asAstNode(routesAst['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];

  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type !== 'ImportDeclaration') continue;
    const specifiers = Array.isArray(stmt['specifiers']) ? stmt['specifiers'] : [];
    for (const raw of specifiers) {
      const spec = asAstNode(raw);
      const local = asAstNode(spec?.['local']);
      if (
        local?.['name'] !== oldComp ||
        typeof local.start !== 'number' ||
        typeof local.end !== 'number'
      ) {
        continue;
      }
      edits.push({ start: local.start, end: local.end, text: newComp });
      const sourceNode = asAstNode(stmt['source']);
      const srcVal = stringOf(sourceNode);
      if (
        sourceNode &&
        srcVal &&
        typeof sourceNode.start === 'number' &&
        typeof sourceNode.end === 'number'
      ) {
        const rawQuote = routesCode[sourceNode.start] === '"' ? '"' : "'";
        const newSrc = srcVal.replace(new RegExp(`/${oldComp}(\\.[a-z0-9]+)?$`), `/${newComp}$1`);
        edits.push({
          start: sourceNode.start,
          end: sourceNode.end,
          text: `${rawQuote}${newSrc}${rawQuote}`,
        });
      }
    }
  }
  return edits;
}

function collectJsxRenameEdits(routeNode: AstNode, oldComp: string, newComp: string): TextEdit[] {
  const edits: TextEdit[] = [];
  function renameJsx(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as AstNode;
    if (n.type === 'JSXIdentifier' && n['name'] === oldComp) {
      if (typeof n.start === 'number' && typeof n.end === 'number') {
        edits.push({ start: n.start, end: n.end, text: newComp });
      }
    }
    for (const [k, v] of Object.entries(n)) {
      if (k !== 'loc' && k !== 'leadingComments' && k !== 'trailingComments') {
        renameJsx(v);
      }
    }
  }
  renameJsx(routeNode);
  return edits;
}

function updateRoutesForRename(
  routesCode: string,
  routesAst: AstNode,
  routeNode: AstNode,
  oldPath: string,
  newPath?: string,
  oldComp?: string,
  newComp?: string,
): Result<string> {
  const edits: TextEdit[] = collectPathEdits(routesCode, routeNode, oldPath, newPath);
  if (oldComp !== undefined && newComp !== undefined && oldComp !== newComp) {
    edits.push(...collectImportRenameEdits(routesCode, routesAst, oldComp, newComp));
    edits.push(...collectJsxRenameEdits(routeNode, oldComp, newComp));
  }
  const applied = applyTextEdits(routesCode, edits);
  if (!applied.ok) return applied;
  return ok(applied.value.code);
}

type PreparedRenameFile = {
  readonly oldFileRel?: string;
  readonly newFileRel?: string;
  readonly oldFileContent?: string;
  readonly newFileContent?: string;
  readonly newCompName?: string;
};

async function prepareRenameComponentFile(
  deps: PageEditDeps,
  targetPage: PageInfo,
  newName?: string,
): Promise<Result<PreparedRenameFile>> {
  if (newName === undefined) return ok({});
  const names = pageNames(newName, deps.language);
  const newCompName = names.component;
  if (!targetPage.file || !targetPage.component) {
    return err({ code: 'E023', params: { reason: 'componentNotFound' } });
  }
  const oldFileRel = targetPage.file;
  if (!(await deps.fs.exists(deps.projectRoot, oldFileRel))) {
    return err({ code: 'E023', params: { reason: 'componentNotFound' } });
  }
  const readOld = await deps.fs.readText(deps.projectRoot, oldFileRel, { keepBom: true });
  if (!readOld.ok) return readOld;
  const oldFileContent = readOld.value;

  const modified = renameComponentInPageCode(oldFileContent, targetPage.component, newCompName);
  if (!modified.ok) return modified;
  const newFileContent = modified.value;

  const ext = path.posix.extname(oldFileRel);
  const newFileRel = `${path.posix.dirname(oldFileRel)}/${newCompName}${ext}`;
  if (newFileRel !== oldFileRel && (await deps.fs.exists(deps.projectRoot, newFileRel))) {
    return err({ code: 'E016', params: { reason: 'fileExists' } });
  }
  return ok({ oldFileRel, newFileRel, oldFileContent, newFileContent, newCompName });
}

function buildRenameHistoryFiles(
  deps: PageEditDeps,
  fileInfo: PreparedRenameFile,
  routesRel: string,
  routesCode: string,
  newRoutesCode: string,
): HistoryFileChange[] {
  const historyFiles: HistoryFileChange[] = [];
  const { oldFileRel, newFileRel, oldFileContent, newFileContent } = fileInfo;
  if (oldFileRel && newFileRel && oldFileContent && newFileContent) {
    if (newFileRel !== oldFileRel) {
      deps.history.recordInternalWrite(oldFileRel, '');
      deps.history.recordInternalWrite(newFileRel, computeSha256(newFileContent));
      historyFiles.push(
        { path: oldFileRel, before: oldFileContent, beforeHash: computeSha256(oldFileContent) },
        { path: newFileRel, after: newFileContent, afterHash: computeSha256(newFileContent) },
      );
    } else {
      deps.history.recordInternalWrite(oldFileRel, computeSha256(newFileContent));
      historyFiles.push({
        path: oldFileRel,
        before: oldFileContent,
        beforeHash: computeSha256(oldFileContent),
        after: newFileContent,
        afterHash: computeSha256(newFileContent),
      });
    }
  }

  const routesHash = computeSha256(newRoutesCode);
  deps.history.recordInternalWrite(routesRel, routesHash);
  historyFiles.push({
    path: routesRel,
    before: routesCode,
    beforeHash: computeSha256(routesCode),
    after: newRoutesCode,
    afterHash: routesHash,
  });
  return historyFiles;
}

type CommitRenameArgs = {
  readonly deps: PageEditDeps;
  readonly routesRel: string;
  readonly routesCode: string;
  readonly newRoutesCode: string;
  readonly fileInfo: PreparedRenameFile;
  readonly labelName: string;
  readonly validatedNewPath?: string | undefined;
};

async function commitRenamePage(args: CommitRenameArgs): Promise<Result<StructureResult>> {
  const { deps, routesRel, routesCode, newRoutesCode, fileInfo, labelName, validatedNewPath } =
    args;
  const { oldFileRel, newFileRel, newFileContent } = fileInfo;
  const touchedFiles = [routesRel];
  if (oldFileRel) touchedFiles.push(oldFileRel);
  if (newFileRel && newFileRel !== oldFileRel) touchedFiles.push(newFileRel);

  return withFileLocks(deps.projectRoot, touchedFiles, async () => {
    if (newFileRel && oldFileRel && newFileContent) {
      const writeNew = await deps.fs.writeTextAtomic(deps.projectRoot, newFileRel, newFileContent);
      if (!writeNew.ok) return writeNew;
      if (newFileRel !== oldFileRel) {
        await deps.fs.remove(deps.projectRoot, oldFileRel);
      }
    }

    const writeRoutes = await deps.fs.writeTextAtomic(deps.projectRoot, routesRel, newRoutesCode);
    if (!writeRoutes.ok) return writeRoutes;

    const files = buildRenameHistoryFiles(deps, fileInfo, routesRel, routesCode, newRoutesCode);
    deps.history.push({
      label: { key: 'history:pageRename', params: { name: labelName } },
      files,
    });

    return ok({
      changed: true,
      files: touchedFiles,
      locs: [],
      ...(validatedNewPath ? { pagePath: validatedNewPath } : {}),
    });
  });
}

function validateRenamePath(
  foundNode: FoundRouteNode,
  oldPath: string,
  newPath: string | undefined,
  existingPages: readonly { readonly path: string }[],
): Result<string | undefined> {
  if (newPath === undefined || newPath === oldPath) return ok(undefined);
  if (foundNode.isIndex) return err({ code: 'E016', params: { reason: 'indexPage' } });
  const validated = normalizeRoute(newPath);
  if (!validateRouteSyntax(validated)) {
    return err({ code: 'E016', params: { reason: 'invalidPath' } });
  }
  if (existingPages.some((p) => p.path === validated)) {
    return err({ code: 'E016', params: { reason: 'pathExists' } });
  }
  return ok(validated);
}

type RouteContext = {
  readonly routesCode: string;
  readonly routesAst: AstNode;
  readonly foundNode: FoundRouteNode;
};

async function loadRouteContext(
  deps: PageEditDeps,
  routesRel: string,
  targetPath: string,
): Promise<Result<RouteContext>> {
  const readRoutes = await deps.fs.readText(deps.projectRoot, routesRel, { keepBom: true });
  if (!readRoutes.ok) return readRoutes;
  const routesCode = readRoutes.value;
  let routesAst: AstNode;
  try {
    routesAst = parseJsxAst(routesCode);
  } catch {
    return err({ code: 'E024', params: { line: 1 } });
  }

  const routeNodes = findRouteNodes(findRouterArray(routesAst) ?? routesAst);
  const foundNode =
    routeNodes.find((r) => r.fullPath === targetPath && !r.hasChildren) ??
    routeNodes.find((r) => r.fullPath === targetPath);
  if (!foundNode) return err({ code: 'E015', params: { resource: 'page', id: targetPath } });
  return ok({ routesCode, routesAst, foundNode });
}

function planRenameRoutesCode(
  routesCode: string,
  routesAst: AstNode,
  routeNode: AstNode,
  oldPath: string,
  validatedNewPath: string | undefined,
  oldComp: string | undefined,
  newComp: string | undefined,
): Result<string> {
  const updatedRoutes = updateRoutesForRename(
    routesCode,
    routesAst,
    routeNode,
    oldPath,
    validatedNewPath,
    oldComp,
    newComp,
  );
  if (!updatedRoutes.ok) return updatedRoutes;
  try {
    parseJsxAst(updatedRoutes.value);
  } catch {
    return err({ code: 'E024', params: { line: 1 } });
  }
  return updatedRoutes;
}

export async function renamePage(
  deps: PageEditDeps,
  input: RenamePageInput,
): Promise<Result<StructureResult>> {
  const pagesInfo = await readPages(deps.fs, deps.projectRoot, deps.sourceDir);
  if (pagesInfo.router.status !== 'found' || !pagesInfo.routesFile) {
    return err(routerNotSupportedError(pagesInfo.router));
  }
  const routesRel = pagesInfo.routesFile;
  const targetPage = pagesInfo.pages.find((p) => p.path === input.path);
  if (!targetPage) return err({ code: 'E015', params: { resource: 'page', id: input.path } });

  const ctxRes = await loadRouteContext(deps, routesRel, input.path);
  if (!ctxRes.ok) return ctxRes;
  const { routesCode, routesAst, foundNode } = ctxRes.value;

  const pathRes = validateRenamePath(foundNode, input.path, input.newPath, pagesInfo.pages);
  if (!pathRes.ok) return pathRes;
  const validatedNewPath = pathRes.value;

  const fileRes = await prepareRenameComponentFile(deps, targetPage, input.newName);
  if (!fileRes.ok) return fileRes;

  const planRes = planRenameRoutesCode(
    routesCode,
    routesAst,
    foundNode.routeNode,
    input.path,
    validatedNewPath,
    targetPage.component,
    fileRes.value.newCompName,
  );
  if (!planRes.ok) return planRes;

  return commitRenamePage({
    deps,
    routesRel,
    routesCode,
    newRoutesCode: planRes.value,
    fileInfo: fileRes.value,
    labelName: input.newName ?? input.path,
    validatedNewPath,
  });
}
