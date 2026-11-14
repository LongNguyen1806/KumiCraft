// Shared write step of the interaction tools: kit files, imports and one history entry (K9.8-1).
import type { KitComponentId, Result } from '@kumicraft/shared';
import { ok } from '@kumicraft/shared';

import type { AstNode } from '../ast-helpers.ts';
import { parseJsxAst } from '../ast-helpers.ts';
import { cacheAst, computeSha256 } from '../source-editor-lookup.ts';
import type { WrittenFile } from '../source-editor-service.ts';
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
  const nextCode = applied.value.code;
  const finalText = hasBom ? `\uFEFF${nextCode}` : nextCode;
  const writeRes = await deps.fs.writeTextAtomic(root, file, finalText);
  if (!writeRes.ok) return writeRes;
  const nextHash = computeSha256(finalText);
  cacheAst(file, nextCode, nextHash, parseJsxAst(nextCode));
  const written = [
    ...prep.value.kitFiles,
    {
      path: file,
      before: rawContent,
      after: finalText,
      beforeHash: computeSha256(rawContent),
      afterHash: nextHash,
    },
  ];
  deps.onWritten?.(written, options.historyKey, options.historyTag);
  return ok(written);
}
