import {
  err,
  ok,
  pageNames,
  type PageNamesResult,
  type PromoteDraft,
  type Result,
  type StructureResult,
} from '@kumicraft/shared';

import { commitFileChanges, type FileChange } from '../../../../kernel/file-writer.ts';
import { asAstNode, type AstNode, parseJsxAst } from '../../../../lib/ast-helpers.ts';
import { resolveRelativeImportSource } from '../structure/imports.ts';
import { updateConfigComponents } from './component-extract.ts';
import { renameComponentInCode, validateDraftFileLocation } from './draft-helpers.ts';
import { getDraftsDir } from './drafts.ts';
import { planNewPageRoutes, validateAddPage, type ValidatedAddPage } from './page-add.ts';
import {
  type PageEditDeps,
  routerNotSupportedError,
  validateDirectory,
  withFileLocks,
} from './page-common.ts';
import { readPages } from './pages.ts';

export function remapAllImportsInCode(code: string, fromFile: string, toFile: string): string {
  let ast: AstNode;
  try {
    ast = parseJsxAst(code);
  } catch {
    return code;
  }
  const prog = asAstNode(ast['program']);
  const body = Array.isArray(prog?.['body']) ? prog['body'] : [];

  type Replacement = { readonly start: number; readonly end: number; readonly text: string };
  const replacements: Replacement[] = [];

  for (const item of body) {
    const decl = asAstNode(item);
    if (decl?.type === 'ImportDeclaration') {
      const srcNode = asAstNode(decl['source']);
      if (!srcNode) continue;
      const srcVal = typeof srcNode['value'] === 'string' ? srcNode['value'] : '';
      if (
        srcVal.startsWith('.') &&
        typeof srcNode['start'] === 'number' &&
        typeof srcNode['end'] === 'number'
      ) {
        const quote = code[srcNode['start']] ?? "'";
        const newSrc = resolveRelativeImportSource(fromFile, toFile, srcVal);
        replacements.push({
          start: srcNode['start'],
          end: srcNode['end'],
          text: `${quote}${newSrc}${quote}`,
        });
      }
    }
  }

  replacements.sort((a, b) => b.start - a.start);
  let res = code;
  for (const r of replacements) {
    res = res.slice(0, r.start) + r.text + res.slice(r.end);
  }
  return res;
}

function hasDefaultExport(code: string): boolean {
  try {
    const ast = parseJsxAst(code);
    const prog = asAstNode(ast['program']);
    const body = Array.isArray(prog?.['body']) ? prog['body'] : [];
    return body.some((item) => asAstNode(item)?.type === 'ExportDefaultDeclaration');
  } catch {
    return false;
  }
}

type PreparedPagePromotion = {
  readonly names: PageNamesResult;
  readonly validated: ValidatedAddPage;
  readonly routesRel: string;
  readonly routesCode: string;
  readonly newRoutesCode: string;
  readonly newPageCode: string;
};

function preparePromotedPageCode(
  draftContent: string,
  componentName: string,
  inputFile: string,
  newFileRel: string,
): Result<string> {
  const renameRes = renameComponentInCode(draftContent, componentName);
  if (!renameRes.ok) return renameRes;
  return ok(remapAllImportsInCode(renameRes.value, inputFile, newFileRel));
}

async function preparePagePromotion(
  deps: PageEditDeps,
  input: PromoteDraft,
  draftContent: string,
): Promise<Result<PreparedPagePromotion>> {
  const pagesInfo = await readPages(deps.fs, deps.projectRoot, deps.sourceDir);
  if (pagesInfo.router.status !== 'found' || !pagesInfo.routesFile) {
    return err(routerNotSupportedError(pagesInfo.router));
  }
  const routesRel = pagesInfo.routesFile;
  const names = pageNames(input.name, deps.language);
  const validated = await validateAddPage(
    deps,
    { name: input.name, dir: input.dir, fileName: input.fileName, path: input.path },
    pagesInfo,
    names,
  );
  if (!validated.ok) return validated;

  const isDefault = hasDefaultExport(draftContent);
  const planned = await planNewPageRoutes(
    deps,
    routesRel,
    names,
    validated.value.routePath,
    validated.value.newFileRel,
    isDefault,
  );
  if (!planned.ok) return planned;

  const codeRes = preparePromotedPageCode(
    draftContent,
    names.component,
    input.file,
    validated.value.newFileRel,
  );
  if (!codeRes.ok) return codeRes;

  return ok({
    names,
    validated: validated.value,
    routesRel,
    routesCode: planned.value.routesCode,
    newRoutesCode: planned.value.newRoutesCode,
    newPageCode: codeRes.value,
  });
}

async function commitPromoteToPage(
  deps: PageEditDeps,
  input: PromoteDraft,
  draftContent: string,
  prep: PreparedPagePromotion,
): Promise<Result<StructureResult>> {
  const { names, validated, routesRel, routesCode, newRoutesCode, newPageCode } = prep;
  const newFileRel = validated.newFileRel;
  const lockPaths = input.keepDraft ? [newFileRel, routesRel] : [input.file, newFileRel, routesRel];

  return withFileLocks(deps.projectRoot, lockPaths, async () => {
    const changes: FileChange[] = [
      { path: newFileRel, before: undefined, after: newPageCode },
      { path: routesRel, before: routesCode, after: newRoutesCode },
    ];
    if (!input.keepDraft)
      changes.push({ path: input.file, before: draftContent, after: undefined });
    const committed = await commitFileChanges(deps, deps.projectRoot, changes, {
      label: { key: 'history:draftPromote', params: { name: names.component } },
    });
    if (!committed.ok) return committed;

    return ok({
      changed: true,
      files: lockPaths,
      locs: [],
      pagePath: validated.routePath,
    });
  });
}

type PreparedComponentPromotion = {
  readonly names: PageNamesResult;
  readonly newFileRel: string;
  readonly newCompCode: string;
};

async function prepareComponentPromotion(
  deps: PageEditDeps,
  input: PromoteDraft,
  draftContent: string,
): Promise<Result<PreparedComponentPromotion>> {
  const names = pageNames(input.name, deps.language);
  const targetDir = input.dir ?? deps.designDirs.components[0] ?? 'src/components';
  const dirCheck = validateDirectory(targetDir, deps.sourceDir, deps.platform);
  if (!dirCheck.ok) return dirCheck;

  const ext = deps.language === 'ts' ? 'tsx' : 'jsx';
  const fileName = input.fileName ?? `${names.component}.${ext}`;
  if (!/^[A-Za-z0-9_-]+\.(tsx|jsx)$/.test(fileName)) {
    return err({ code: 'E016', params: { reason: 'invalidFileName' } });
  }

  const newFileRel = `${targetDir}/${fileName}`;
  if (await deps.fs.exists(deps.projectRoot, newFileRel)) {
    return err({ code: 'E016', params: { reason: 'fileExists' } });
  }

  const renameRes = renameComponentInCode(draftContent, names.component);
  if (!renameRes.ok) return renameRes;
  const newCompCode = remapAllImportsInCode(renameRes.value, input.file, newFileRel);

  return ok({ names, newFileRel, newCompCode });
}

async function commitPromoteToComponent(
  deps: PageEditDeps,
  input: PromoteDraft,
  draftContent: string,
  prep: PreparedComponentPromotion,
): Promise<Result<StructureResult>> {
  const { names, newFileRel, newCompCode } = prep;
  const lockPaths = input.keepDraft ? [newFileRel] : [input.file, newFileRel];

  return withFileLocks(deps.projectRoot, lockPaths, async () => {
    const changes: FileChange[] = [{ path: newFileRel, before: undefined, after: newCompCode }];
    if (!input.keepDraft)
      changes.push({ path: input.file, before: draftContent, after: undefined });
    const committed = await commitFileChanges(deps, deps.projectRoot, changes, {
      label: { key: 'history:draftPromote', params: { name: names.component } },
    });
    if (!committed.ok) return committed;

    await updateConfigComponents(deps, newFileRel);

    return ok({ changed: true, files: lockPaths, locs: [] });
  });
}

export async function promoteDraft(
  deps: PageEditDeps,
  input: PromoteDraft,
): Promise<Result<StructureResult>> {
  const draftsDir = getDraftsDir(deps);
  const locCheck = validateDraftFileLocation(input.file, draftsDir, deps);
  if (!locCheck.ok) return locCheck;

  if (!(await deps.fs.exists(deps.projectRoot, input.file))) {
    return err({ code: 'E017', params: { loc: input.file, reason: 'notFound' } });
  }

  const readDraft = await deps.fs.readText(deps.projectRoot, input.file);
  if (!readDraft.ok) return readDraft;

  if (input.as === 'page') {
    const prep = await preparePagePromotion(deps, input, readDraft.value);
    if (!prep.ok) return prep;
    return commitPromoteToPage(deps, input, readDraft.value, prep.value);
  }

  const prep = await prepareComponentPromotion(deps, input, readDraft.value);
  if (!prep.ok) return prep;
  return commitPromoteToComponent(deps, input, readDraft.value, prep.value);
}
