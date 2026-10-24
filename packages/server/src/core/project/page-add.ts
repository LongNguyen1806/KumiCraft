// Adding a page to the project router and filesystem (R-PG-11, R-PG-12, R-PG-13).
import * as path from 'node:path';

import {
  err,
  ok,
  pageNames,
  type PageNamesResult,
  type PagesInfo,
  type Result,
  type StructureResult,
} from '@kumicraft/shared';

import { computeSha256 } from '../history/history-service.ts';
import { type AstNode, detectFormat, parseJsxAst } from '../source-editor/ast-helpers.ts';
import { getTopLevelIdentifiers } from '../source-editor/structure/imports.ts';
import { applyTextEdits } from '../source-editor/structure/text-edits.ts';
import {
  type AddPageInput,
  escapeJsxText,
  normalizeRoute,
  type PageEditDeps,
  validateDirectory,
  validateRouteSyntax,
  withFileLocks,
} from './page-common.ts';
import { readPages } from './pages.ts';
import { planAddRouteEdits, routesUseExtension } from './routes-ast.ts';

function buildNewPageSource(component: string, name: string): string {
  return [
    `export function ${component}() {`,
    '  return (',
    '    <main className="mx-auto max-w-5xl p-8">',
    `      <h1 className="text-3xl font-bold">${escapeJsxText(name)}</h1>`,
    '    </main>',
    '  );',
    '}\n',
  ].join('\n');
}

function computeRouteImport(routesRel: string, newFileRel: string, routesAst: AstNode): string {
  const routesDir = path.posix.dirname(routesRel);
  let relImport = path.posix.relative(routesDir, newFileRel);
  if (!relImport.startsWith('.')) relImport = `./${relImport}`;
  if (!routesUseExtension(routesAst)) {
    relImport = relImport.replace(/\.(tsx|jsx)$/, '');
  }
  return relImport;
}

export type ValidatedAddPage = {
  readonly routePath: string;
  readonly newFileRel: string;
};

export async function validateAddPage(
  deps: PageEditDeps,
  input: AddPageInput,
  pagesInfo: PagesInfo,
  names: PageNamesResult,
): Promise<Result<ValidatedAddPage>> {
  const routePath = normalizeRoute(input.path ?? names.path);
  if (!validateRouteSyntax(routePath)) {
    return err({ code: 'E016', params: { reason: 'invalidPath' } });
  }
  if (pagesInfo.pages.some((p) => p.path === routePath)) {
    return err({ code: 'E016', params: { reason: 'pathExists' } });
  }

  const targetDir = input.dir ?? deps.designDirs.pages;
  const dirCheck = validateDirectory(targetDir, deps.sourceDir, deps.platform);
  if (!dirCheck.ok) return dirCheck;

  const fileName = input.fileName ?? names.fileName;
  if (!/^[A-Za-z0-9_-]+\.(tsx|jsx)$/.test(fileName)) {
    return err({ code: 'E016', params: { reason: 'invalidFileName' } });
  }
  const newFileRel = `${targetDir}/${fileName}`;
  if (await deps.fs.exists(deps.projectRoot, newFileRel)) {
    return err({ code: 'E016', params: { reason: 'fileExists' } });
  }
  return ok({ routePath, newFileRel });
}

export type PlannedRoutes = {
  readonly routesCode: string;
  readonly newRoutesCode: string;
};

export async function planNewPageRoutes(
  deps: PageEditDeps,
  routesRel: string,
  names: PageNamesResult,
  routePath: string,
  newFileRel: string,
): Promise<Result<PlannedRoutes>> {
  const readRoutes = await deps.fs.readText(deps.projectRoot, routesRel, { keepBom: true });
  if (!readRoutes.ok) return readRoutes;
  const routesCode = readRoutes.value;
  let routesAst: AstNode;
  try {
    routesAst = parseJsxAst(routesCode);
  } catch {
    return err({ code: 'E024', params: { line: 1 } });
  }

  if (getTopLevelIdentifiers(routesAst).has(names.component)) {
    return err({ code: 'E016', params: { reason: 'nameExists' } });
  }

  const relImport = computeRouteImport(routesRel, newFileRel, routesAst);
  const format = detectFormat(routesCode);
  const planRes = planAddRouteEdits(routesAst, routesCode, format.newline, {
    component: names.component,
    importPath: relImport,
    routePath,
  });
  if (!planRes.ok) return planRes;

  const appliedRes = applyTextEdits(routesCode, planRes.value);
  if (!appliedRes.ok) return appliedRes;
  const newRoutesCode = appliedRes.value.code;

  try {
    parseJsxAst(newRoutesCode);
  } catch {
    return err({ code: 'E024', params: { line: 1 } });
  }
  return ok({ routesCode, newRoutesCode });
}

type CommitAddPageArgs = {
  readonly deps: PageEditDeps;
  readonly inputName: string;
  readonly routePath: string;
  readonly routesRel: string;
  readonly newFileRel: string;
  readonly routesCode: string;
  readonly newRoutesCode: string;
  readonly newFileContent: string;
};

async function commitAddPage(args: CommitAddPageArgs): Promise<Result<StructureResult>> {
  const {
    deps,
    inputName,
    routePath,
    routesRel,
    newFileRel,
    routesCode,
    newRoutesCode,
    newFileContent,
  } = args;
  return withFileLocks(deps.projectRoot, [routesRel, newFileRel], async () => {
    const writeNew = await deps.fs.writeTextAtomic(deps.projectRoot, newFileRel, newFileContent);
    if (!writeNew.ok) return writeNew;

    const writeRoutes = await deps.fs.writeTextAtomic(deps.projectRoot, routesRel, newRoutesCode);
    if (!writeRoutes.ok) {
      await deps.fs.remove(deps.projectRoot, newFileRel);
      return writeRoutes;
    }

    const newHash = computeSha256(newFileContent);
    const routesHash = computeSha256(newRoutesCode);
    deps.history.recordInternalWrite(newFileRel, newHash);
    deps.history.recordInternalWrite(routesRel, routesHash);

    deps.history.push({
      label: { key: 'history:pageAdd', params: { name: inputName } },
      files: [
        { path: newFileRel, after: newFileContent, afterHash: newHash },
        {
          path: routesRel,
          before: routesCode,
          beforeHash: computeSha256(routesCode),
          after: newRoutesCode,
          afterHash: routesHash,
        },
      ],
    });

    return ok({
      changed: true,
      files: [routesRel, newFileRel],
      locs: [],
      pagePath: routePath,
    });
  });
}

export async function addPage(
  deps: PageEditDeps,
  input: AddPageInput,
): Promise<Result<StructureResult>> {
  const pagesInfo = await readPages(deps.fs, deps.projectRoot, deps.sourceDir);
  if (!pagesInfo.convention || !pagesInfo.routesFile) {
    return err({ code: 'E016', params: { reason: 'notConvention' } });
  }
  const routesRel = pagesInfo.routesFile;
  const names = pageNames(input.name, deps.language);

  const validated = await validateAddPage(deps, input, pagesInfo, names);
  if (!validated.ok) return validated;
  const { routePath, newFileRel } = validated.value;

  const planned = await planNewPageRoutes(deps, routesRel, names, routePath, newFileRel);
  if (!planned.ok) return planned;

  return commitAddPage({
    deps,
    inputName: input.name,
    routePath,
    routesRel,
    newFileRel,
    routesCode: planned.value.routesCode,
    newRoutesCode: planned.value.newRoutesCode,
    newFileContent: buildNewPageSource(names.component, input.name),
  });
}
