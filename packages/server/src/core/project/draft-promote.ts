import {
  err,
  ok,
  pageNames,
  type PageNamesResult,
  type PromoteDraft,
  type Result,
  type StructureResult,
} from '@kumicraft/shared';

import { computeSha256, type HistoryFileChange } from '../history/history-service.ts';
import { asAstNode, type AstNode, parseJsxAst } from '../source-editor/ast-helpers.ts';
import { resolveRelativeImportSource } from '../source-editor/structure/imports.ts';
import { updateConfigComponents } from './component-extract.ts';
import { renameComponentInCode, validateDraftFileLocation } from './draft-helpers.ts';
import { getDraftsDir } from './drafts.ts';
import { planNewPageRoutes, validateAddPage, type ValidatedAddPage } from './page-add.ts';
import { type PageEditDeps, validateDirectory, withFileLocks } from './page-common.ts';
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

type PreparedPagePromotion = {
  readonly names: PageNamesResult;
  readonly validated: ValidatedAddPage;
  readonly routesRel: string;
  readonly routesCode: string;
  readonly newRoutesCode: string;
  readonly newPageCode: string;
};

async function preparePagePromotion(
  deps: PageEditDeps,
  input: PromoteDraft,
  draftContent: string,
): Promise<Result<PreparedPagePromotion>> {
  const pagesInfo = await readPages(deps.fs, deps.projectRoot, deps.sourceDir);
  const routesRel = pagesInfo.routesFile;
  if (!routesRel) {
    return err({ code: 'E016', params: { reason: 'notConvention' } });
  }

  const names = pageNames(input.name, deps.language);
  const validated = await validateAddPage(
    deps,
    {
      name: input.name,
      dir: input.dir,
      fileName: input.fileName,
      path: input.path,
    },
    pagesInfo,
    names,
  );
  if (!validated.ok) return validated;

  const planned = await planNewPageRoutes(
    deps,
    routesRel,
    names,
    validated.value.routePath,
    validated.value.newFileRel,
  );
  if (!planned.ok) return planned;

  const renameRes = renameComponentInCode(draftContent, names.component);
  if (!renameRes.ok) return renameRes;
  const newPageCode = remapAllImportsInCode(
    renameRes.value,
    input.file,
    validated.value.newFileRel,
  );

  return ok({
    names,
    validated: validated.value,
    routesRel,
    routesCode: planned.value.routesCode,
    newRoutesCode: planned.value.newRoutesCode,
    newPageCode,
  });
}

function recordPromotePageHistory(
  deps: PageEditDeps,
  input: PromoteDraft,
  prep: PreparedPagePromotion,
  draftContent: string,
  hashes: {
    readonly oldDraftHash: string;
    readonly newPageHash: string;
    readonly oldRoutesHash: string;
    readonly newRoutesHash: string;
  },
): void {
  const { names, validated, routesRel, routesCode, newRoutesCode, newPageCode } = prep;
  deps.history.recordInternalWrite(validated.newFileRel, hashes.newPageHash);
  deps.history.recordInternalWrite(routesRel, hashes.newRoutesHash);

  const historyFiles: HistoryFileChange[] = [
    { path: validated.newFileRel, after: newPageCode, afterHash: hashes.newPageHash },
    {
      path: routesRel,
      before: routesCode,
      beforeHash: hashes.oldRoutesHash,
      after: newRoutesCode,
      afterHash: hashes.newRoutesHash,
    },
  ];
  if (!input.keepDraft) {
    historyFiles.push({ path: input.file, before: draftContent, beforeHash: hashes.oldDraftHash });
  }

  deps.history.push({
    label: { key: 'history:draftPromote', params: { name: names.component } },
    files: historyFiles,
  });
}

async function commitPromoteToPage(
  deps: PageEditDeps,
  input: PromoteDraft,
  draftContent: string,
  prep: PreparedPagePromotion,
): Promise<Result<StructureResult>> {
  const { validated, routesRel, routesCode, newPageCode } = prep;
  const newFileRel = validated.newFileRel;
  const oldDraftHash = computeSha256(draftContent);
  const newPageHash = computeSha256(newPageCode);
  const oldRoutesHash = computeSha256(routesCode);
  const newRoutesHash = computeSha256(prep.newRoutesCode);

  const lockPaths = input.keepDraft ? [newFileRel, routesRel] : [input.file, newFileRel, routesRel];

  return withFileLocks(deps.projectRoot, lockPaths, async () => {
    const writePage = await deps.fs.writeTextAtomic(deps.projectRoot, newFileRel, newPageCode);
    if (!writePage.ok) return writePage;

    const writeRoutes = await deps.fs.writeTextAtomic(
      deps.projectRoot,
      routesRel,
      prep.newRoutesCode,
    );
    if (!writeRoutes.ok) {
      await deps.fs.remove(deps.projectRoot, newFileRel);
      return writeRoutes;
    }

    if (!input.keepDraft) {
      const rmDraft = await deps.fs.remove(deps.projectRoot, input.file);
      if (!rmDraft.ok) {
        await deps.fs.remove(deps.projectRoot, newFileRel);
        await deps.fs.writeTextAtomic(deps.projectRoot, routesRel, routesCode);
        return rmDraft;
      }
    }

    recordPromotePageHistory(deps, input, prep, draftContent, {
      oldDraftHash,
      newPageHash,
      oldRoutesHash,
      newRoutesHash,
    });

    const touchedFiles = input.keepDraft
      ? [newFileRel, routesRel]
      : [input.file, newFileRel, routesRel];
    return ok({
      changed: true,
      files: touchedFiles,
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
  const targetDir = input.dir ?? deps.designDirs.components;
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
  const oldDraftHash = computeSha256(draftContent);
  const newCompHash = computeSha256(newCompCode);
  const lockPaths = input.keepDraft ? [newFileRel] : [input.file, newFileRel];

  return withFileLocks(deps.projectRoot, lockPaths, async () => {
    const writeComp = await deps.fs.writeTextAtomic(deps.projectRoot, newFileRel, newCompCode);
    if (!writeComp.ok) return writeComp;

    if (!input.keepDraft) {
      const rmDraft = await deps.fs.remove(deps.projectRoot, input.file);
      if (!rmDraft.ok) {
        await deps.fs.remove(deps.projectRoot, newFileRel);
        return rmDraft;
      }
    }

    deps.history.recordInternalWrite(newFileRel, newCompHash);
    const historyFiles: HistoryFileChange[] = [
      { path: newFileRel, after: newCompCode, afterHash: newCompHash },
    ];
    if (!input.keepDraft) {
      historyFiles.push({ path: input.file, before: draftContent, beforeHash: oldDraftHash });
    }

    deps.history.push({
      label: { key: 'history:draftPromote', params: { name: names.component } },
      files: historyFiles,
    });

    await updateConfigComponents(deps, newFileRel);

    const touchedFiles = input.keepDraft ? [newFileRel] : [input.file, newFileRel];
    return ok({
      changed: true,
      files: touchedFiles,
      locs: [],
    });
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
