import path from 'node:path';

import type { KitComponentId, Result, StructureEdit } from '@kumicraft/shared';
import { ok } from '@kumicraft/shared';

import type { WrittenFile } from '../../../../kernel/editing.ts';
import { commitFileChanges } from '../../../../kernel/file-writer.ts';
import type { FileSystemPort } from '../../../../ports/file-system-port.ts';
import type { SnippetFormatter } from '../snippet-format.ts';
import { computeSha256 } from '../source-editor-lookup.ts';
import { buildDataFileContent } from './data-repeat-extract.ts';
import { groupKitComponentsByFile, type KitFilePlan } from './kit-templates/index.ts';

export type PendingKitFile = {
  readonly relPath: string;
  readonly content: string;
};

export type KitPlan = {
  readonly imports: readonly string[];
  readonly filesToCreate: readonly PendingKitFile[];
  readonly allKitPaths: readonly string[];
  readonly importBases: readonly string[];
};

function toRelativeImportBase(targetRel: string, kitDir: string, fileBase: string): string {
  const fromDir = path.posix.dirname(targetRel.replace(/\\/g, '/'));
  const targetNoExt = `${kitDir.replace(/\\/g, '/')}/${fileBase}`;
  const rel = path.posix.relative(fromDir === '.' ? '' : fromDir, targetNoExt);
  return rel.startsWith('.') ? rel : `./${rel}`;
}

async function resolveFileCreation(
  fs: FileSystemPort,
  projectRoot: string,
  kitDir: string,
  plan: KitFilePlan,
  typescript: boolean,
): Promise<PendingKitFile | undefined> {
  const ext = typescript ? 'tsx' : 'jsx';
  const altExt = typescript ? 'jsx' : 'tsx';
  const relPath = path.posix.join(kitDir, `${plan.fileBase}.${ext}`);
  const altRelPath = path.posix.join(kitDir, `${plan.fileBase}.${altExt}`);
  if ((await fs.exists(projectRoot, relPath)) || (await fs.exists(projectRoot, altRelPath))) {
    return undefined;
  }
  return {
    relPath,
    content: plan.buildCode(typescript),
  };
}

export async function prepareKitPlan(
  fs: FileSystemPort,
  projectRoot: string,
  sourceDir: string,
  targetRel: string,
  components: readonly KitComponentId[],
): Promise<KitPlan> {
  const typescript = targetRel.endsWith('.tsx') || (await fs.exists(projectRoot, 'tsconfig.json'));
  const normalizedSrc = sourceDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const kitDir = normalizedSrc.length > 0 ? `${normalizedSrc}/kumicraft` : 'kumicraft';
  const plans = groupKitComponentsByFile(components);
  const imports: string[] = [];
  const filesToCreate: PendingKitFile[] = [];
  const allKitPaths: string[] = [];
  const importBases: string[] = [];

  for (const plan of plans) {
    const importBase = toRelativeImportBase(targetRel, kitDir, plan.fileBase);
    importBases.push(importBase);
    imports.push(`import { ${plan.exportedSymbols.join(', ')} } from '${importBase}';`);

    const ext = typescript ? 'tsx' : 'jsx';
    allKitPaths.push(path.posix.join(kitDir, `${plan.fileBase}.${ext}`));

    const pending = await resolveFileCreation(fs, projectRoot, kitDir, plan, typescript);
    if (pending !== undefined) {
      filesToCreate.push(pending);
    }
  }

  return { imports, filesToCreate, allKitPaths, importBases };
}

export async function commitKitFiles(
  fs: FileSystemPort,
  projectRoot: string,
  files: readonly PendingKitFile[],
): Promise<Result<readonly WrittenFile[]>> {
  // All or nothing, and never over a kit file the user already has (FileWriter: new files only).
  const res = await commitFileChanges(
    { fs },
    projectRoot,
    files.map((file) => ({ path: file.relPath, before: undefined, after: file.content })),
  );
  if (!res.ok) return res;
  return ok(
    files.map((file) => ({
      path: file.relPath,
      after: file.content,
      afterHash: computeSha256(file.content),
    })),
  );
}

export function mergeKitImports(
  edit: StructureEdit,
  kitPlan: KitPlan | undefined,
  targetRel: string | undefined,
): StructureEdit {
  if (
    edit.kind !== 'insert' ||
    kitPlan === undefined ||
    kitPlan.imports.length === 0 ||
    targetRel === undefined
  ) {
    return edit;
  }
  return {
    ...edit,
    from: {
      file: edit.from?.file ?? targetRel,
      imports: [...(edit.from?.imports ?? []), ...kitPlan.imports],
    },
  };
}

export async function prepareEditFormatting(
  edit: StructureEdit,
  targetRel: string | undefined,
  projectRoot: string,
  formatSnippet: SnippetFormatter | undefined,
  kitPlan: KitPlan | undefined,
): Promise<StructureEdit> {
  const formatted =
    edit.kind === 'insert' && formatSnippet !== undefined && targetRel !== undefined
      ? { ...edit, jsx: await formatSnippet({ projectRoot, file: targetRel, jsx: edit.jsx }) }
      : edit;
  return mergeKitImports(formatted, kitPlan, targetRel);
}

/** Builds kit component + optional `.data.ts` file creation plan for insert edits. */
export async function prepareInsertKitWithData(
  fs: FileSystemPort,
  projectRoot: string,
  sourceDir: string,
  edit: StructureEdit,
  targetRel: string | undefined,
): Promise<KitPlan | undefined> {
  if (edit.kind !== 'insert') return undefined;
  const base =
    edit.kit !== undefined && targetRel !== undefined
      ? await prepareKitPlan(fs, projectRoot, sourceDir, targetRel, edit.kit.components)
      : undefined;
  if (edit.dataArray === undefined || (await fs.exists(projectRoot, edit.dataArray.file))) {
    return base;
  }
  const dataFile = {
    relPath: edit.dataArray.file,
    content: buildDataFileContent(edit.dataArray.exportName, edit.dataArray.rows, '\n'),
  };
  return {
    imports: base?.imports ?? [],
    filesToCreate: [...(base?.filesToCreate ?? []), dataFile],
    allKitPaths: base?.allKitPaths ?? [],
    importBases: base?.importBases ?? [],
  };
}
