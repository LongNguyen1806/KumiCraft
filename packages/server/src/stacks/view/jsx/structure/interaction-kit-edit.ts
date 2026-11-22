// Shared write step of the interaction tools: kit files, imports and one history entry (K9.8-1).
import type { KitComponentId, Result } from '@kumicraft/shared';
import { ok } from '@kumicraft/shared';

import type { WrittenFile } from '../../../../kernel/editing.ts';
import { commitFileChanges } from '../../../../kernel/file-writer.ts';
import type { AstNode } from '../../../../lib/ast-helpers.ts';
import { parseJsxAst } from '../../../../lib/ast-helpers.ts';
import { cacheAst, computeSha256 } from '../source-editor-lookup.ts';
import { buildMissingImportsEdits } from './imports.ts';
import { commitKitFiles, prepareKitPlan } from './kit-service.ts';
import type { InteractionOpsDeps } from './select-group-ops.ts';
import { applyTextEdits, type TextEdit } from './text-edits.ts';

export function escapeAttr(val: string): string {
  return val.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export async function prepareKitAndImports(options: {
  readonly deps: InteractionOpsDeps;
  readonly root: string;
  readonly file: string;
  readonly code: string;
  readonly newline: '\r\n' | '\n';
  readonly ast: AstNode;
  readonly kitComponents: readonly KitComponentId[];
  readonly extraImports?: readonly string[] | undefined;
}): Promise<
  Result<{ readonly importEdits: readonly TextEdit[]; readonly kitFiles: readonly WrittenFile[] }>
> {
  const { deps, root, file, code, newline, ast, kitComponents, extraImports } = options;
  if (kitComponents.length === 0) {
    if (!extraImports || extraImports.length === 0) return ok({ importEdits: [], kitFiles: [] });
    const imp = buildMissingImportsEdits(
      ast,
      code,
      file,
      ['Link'],
      { file, imports: extraImports },
      newline,
    );
    return ok({ importEdits: imp.edits, kitFiles: [] });
  }
  const srcDir = deps.sourceDir ?? (file.startsWith('src/') ? 'src' : '');
  const kitPlan = await prepareKitPlan(deps.fs, root, srcDir, file, kitComponents);
  const imp = buildMissingImportsEdits(
    ast,
    code,
    file,
    kitComponents,
    { file, imports: [...kitPlan.imports, ...(extraImports ?? [])] },
    newline,
  );
  const kitCommit = await commitKitFiles(deps.fs, root, kitPlan.filesToCreate);
  if (!kitCommit.ok) return kitCommit;
  return ok({ importEdits: imp.edits, kitFiles: kitCommit.value });
}

export async function finishJsxKitEdit(options: {
  readonly deps: InteractionOpsDeps;
  readonly root: string;
  readonly file: string;
  readonly rawContent: string;
  readonly code: string;
  readonly hasBom: boolean;
  readonly newline: '\r\n' | '\n';
  readonly ast: AstNode;
  readonly edits: readonly TextEdit[];
  readonly kitComponents: readonly KitComponentId[];
  readonly extraImports?: readonly string[] | undefined;
  readonly historyKey: string;
  readonly historyTag: string;
}): Promise<Result<readonly WrittenFile[]>> {
  const { deps, root, file, rawContent, code, hasBom, newline, ast, edits, kitComponents } =
    options;
  const prep = await prepareKitAndImports({
    deps,
    root,
    file,
    code,
    newline,
    ast,
    kitComponents,
    extraImports: options.extraImports,
  });
  if (!prep.ok) return prep;
  const applied = applyTextEdits(code, [...edits, ...prep.value.importEdits]);
  if (!applied.ok) return applied;
  const main = await writeJsxFile(deps, root, file, rawContent, {
    nextCode: applied.value.code,
    hasBom,
  });
  if (!main.ok) return main;
  const written = [...prep.value.kitFiles, main.value];
  deps.onWritten?.(written, options.historyKey, options.historyTag);
  return ok(written);
}

/** Writes the edited JSX file through the FileWriter and keeps its parsed AST for the next edit. */
async function writeJsxFile(
  deps: InteractionOpsDeps,
  root: string,
  file: string,
  rawContent: string,
  next: { readonly nextCode: string; readonly hasBom: boolean },
): Promise<Result<WrittenFile>> {
  const finalText = next.hasBom ? `\uFEFF${next.nextCode}` : next.nextCode;
  const writeRes = await commitFileChanges({ fs: deps.fs }, root, [
    { path: file, before: rawContent, after: finalText },
  ]);
  if (!writeRes.ok) return writeRes;
  const nextHash = computeSha256(finalText);
  cacheAst(file, next.nextCode, nextHash, parseJsxAst(next.nextCode));
  return ok({
    path: file,
    before: rawContent,
    after: finalText,
    beforeHash: computeSha256(rawContent),
    afterHash: nextHash,
  });
}
