// Deleting a page from the router and filesystem (R-PG-14).
import { err, ok, type Result, type StructureResult } from '@kumicraft/shared';

import { commitFileChanges } from '../../../../kernel/file-writer.ts';
import { type AstNode, parseJsxAst } from '../../../../lib/ast-helpers.ts';
import { applyTextEdits } from '../structure/text-edits.ts';
import {
  type DeletePageInput,
  type PageEditDeps,
  routerNotSupportedError,
  withFileLocks,
} from './page-common.ts';
import { readPages } from './pages.ts';
import { findRouteNodes, findRouterArray, planDeleteRouteEdits } from './routes-ast.ts';

type PlannedDeleteRoutes = {
  readonly routesCode: string;
  readonly newRoutesCode: string;
};

async function planDeleteRoutes(
  deps: PageEditDeps,
  routesRel: string,
  inputPath: string,
  targetComponent?: string,
): Promise<Result<PlannedDeleteRoutes>> {
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
    routeNodes.find((r) => r.fullPath === inputPath && !r.hasChildren) ??
    routeNodes.find((r) => r.fullPath === inputPath);
  if (!foundNode) return err({ code: 'E015', params: { resource: 'page', id: inputPath } });

  const deleteEdits = planDeleteRouteEdits(
    routesAst,
    routesCode,
    foundNode.routeNode,
    targetComponent,
  );
  if (!deleteEdits.ok) return deleteEdits;

  const applied = applyTextEdits(routesCode, deleteEdits.value);
  if (!applied.ok) return applied;
  const newRoutesCode = applied.value.code;

  try {
    parseJsxAst(newRoutesCode);
  } catch {
    return err({ code: 'E024', params: { line: 1 } });
  }
  return ok({ routesCode, newRoutesCode });
}

type CommitDeletePageArgs = {
  readonly deps: PageEditDeps;
  readonly targetName: string;
  readonly routesRel: string;
  readonly pageFileRel: string;
  readonly routesCode: string;
  readonly newRoutesCode: string;
  readonly pageFileContent: string;
};

async function commitDeletePage(args: CommitDeletePageArgs): Promise<Result<StructureResult>> {
  const { deps, targetName, routesRel, pageFileRel, routesCode, newRoutesCode, pageFileContent } =
    args;
  return withFileLocks(deps.projectRoot, [routesRel, pageFileRel], async () => {
    const committed = await commitFileChanges(
      deps,
      deps.projectRoot,
      [
        { path: pageFileRel, before: pageFileContent, after: undefined },
        { path: routesRel, before: routesCode, after: newRoutesCode },
      ],
      { label: { key: 'history:pageDelete', params: { name: targetName } } },
    );
    if (!committed.ok) return committed;

    return ok({
      changed: true,
      files: [routesRel, pageFileRel],
      locs: [],
    });
  });
}

export async function deletePage(
  deps: PageEditDeps,
  input: DeletePageInput,
): Promise<Result<StructureResult>> {
  const pagesInfo = await readPages(deps.fs, deps.projectRoot, deps.sourceDir);
  if (pagesInfo.router.status !== 'found' || !pagesInfo.routesFile) {
    return err(routerNotSupportedError(pagesInfo.router));
  }
  const routesRel = pagesInfo.routesFile;

  const actualPages = pagesInfo.pages.filter((p) => !p.path.includes('*'));
  if (actualPages.length <= 1) {
    return err({ code: 'E016', params: { reason: 'lastPage' } });
  }

  const targetPage = actualPages.find((p) => p.path === input.path);
  if (!targetPage) return err({ code: 'E015', params: { resource: 'page', id: input.path } });
  if (!targetPage.file || !(await deps.fs.exists(deps.projectRoot, targetPage.file))) {
    return err({ code: 'E023', params: { reason: 'componentNotFound' } });
  }
  const pageFileRel = targetPage.file;

  const readOld = await deps.fs.readText(deps.projectRoot, pageFileRel, { keepBom: true });
  if (!readOld.ok) return readOld;

  const planned = await planDeleteRoutes(deps, routesRel, input.path, targetPage.component);
  if (!planned.ok) return planned;

  return commitDeletePage({
    deps,
    targetName: targetPage.component ?? input.path,
    routesRel,
    pageFileRel,
    routesCode: planned.value.routesCode,
    newRoutesCode: planned.value.newRoutesCode,
    pageFileContent: readOld.value,
  });
}
