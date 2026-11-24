// Planning and import management for CSS files in style application (SPEC-04 M-ST, R-ST-06).
import { posix } from 'node:path';

import { err, ok, type Result } from '@kumicraft/shared';

import type { WrittenFile } from '../../kernel/editing.ts';
import { findImportInsertPosition, parseJsxAst } from '../../lib/ast-helpers.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { readFile, writeFile } from './style-apply-common.ts';

export type CssFilePlan = {
  readonly file: string;
  /** Set when `file` is new: the name the JSX file must import once the file exists. */
  readonly importAs?: string | undefined;
};

export function isJsxLikeFile(file: string): boolean {
  return /\.[jt]sx?$/i.test(file);
}

/** The plain `.css`, `.scss`, or `.less` file the element's own file imports, if any. */
export function importedCss(code: string, jsxFile: string): string | undefined {
  const m = /import\s+['"](\.{1,2}\/[^'"]+(?<!\.module)\.(?:css|scss|sass|less))['"]/.exec(code);
  return m?.[1] === undefined
    ? undefined
    : posix.normalize(posix.join(posix.dirname(jsxFile), m[1]));
}

/** Adds `import '<specifier>';`; the specifier is relative to the JSX file (`./Card.css`). */
export function addCssImport(code: string, specifier: string): string {
  const eol = code.includes('\r\n') ? '\r\n' : '\n';
  const at = findImportInsertPosition(parseJsxAst(code), code);
  return `${code.slice(0, at)}import '${specifier}';${eol}${code.slice(at)}`;
}

/**
 * Where an element's new rule goes: the winning rule's file, the CSS its file imports, or a new
 * `<File>.css` beside it. Nothing is written: the import of a new file is added only after the
 * file exists, since Vite fails on an import of a missing file (and misses the HMR).
 */
export async function planCssFile(
  deps: { readonly fs: FileSystemPort },
  root: string,
  jsxFile: string,
  winner: { readonly file: string } | undefined,
  newCssDir?: string,
  globalCss?: readonly string[],
): Promise<Result<CssFilePlan>> {
  if (winner !== undefined) return ok({ file: winner.file });
  if (!isJsxLikeFile(jsxFile)) {
    const target = globalCss?.[0];
    if (target === undefined) return err({ code: 'E016', params: { reason: 'noStylesheet' } });
    return ok({ file: target });
  }
  const jsx = await readFile(deps.fs, root, jsxFile);
  if (!jsx.ok) return jsx;
  const imported = importedCss(jsx.value, jsxFile);
  if (imported !== undefined) return ok({ file: imported });

  const baseName = posix.basename(jsxFile).replace(/\.[jt]sx?$/, '');
  if (newCssDir) {
    let candidateFile = posix.join(newCssDir, `${baseName}.css`);
    let counter = 2;
    while (await deps.fs.exists(root, candidateFile)) {
      candidateFile = posix.join(newCssDir, `${baseName}-${String(counter)}.css`);
      counter += 1;
    }
    const jsxDir = posix.dirname(jsxFile);
    let rel = posix.relative(jsxDir, candidateFile);
    if (!rel.startsWith('./') && !rel.startsWith('../')) rel = `./${rel}`;
    return ok({ file: candidateFile, importAs: rel });
  }

  const name = `${baseName}.css`;
  return ok({ file: posix.join(posix.dirname(jsxFile), name), importAs: `./${name}` });
}

/** Adds the import a `planCssFile` plan asks for; call it after the CSS file is written. */
export async function addPlannedImport(
  deps: { readonly fs: FileSystemPort },
  root: string,
  jsxFile: string,
  plan: CssFilePlan,
  writes: WrittenFile[],
): Promise<Result<WrittenFile | undefined>> {
  if (plan.importAs === undefined || !isJsxLikeFile(jsxFile)) return ok(undefined);
  const jsx = await readFile(deps.fs, root, jsxFile);
  if (!jsx.ok) return jsx;
  if (importedCss(jsx.value, jsxFile) === plan.file) return ok(undefined);
  const added = await writeFile(
    deps.fs,
    root,
    jsxFile,
    jsx.value,
    addCssImport(jsx.value, plan.importAs),
  );
  if (!added.ok) return added;
  writes.push(added.value);
  return ok(added.value);
}
