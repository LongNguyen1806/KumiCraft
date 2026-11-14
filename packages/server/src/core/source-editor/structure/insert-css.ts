// Appends missing CSS rules when inserting a Library block for non-Tailwind/Bootstrap systems (R-ST-12, R-ST-15).
import {
  err,
  type InsertedCssRule,
  InsertedCssRuleSchema,
  ok,
  primarySystem,
  type Result,
  splitSelectorList,
  type StructureEdit,
  type StructureResult,
  type StylingReport,
} from '@kumicraft/shared';

import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { appendRule } from '../../style/css-edit.ts';
import { normalizeSelector, parseStylesheet } from '../../style/css-locate.ts';
import {
  addPlannedImport,
  mergeWrites,
  planCssFile,
  readFile,
  writeFile,
} from '../../style/style-apply.ts';
import { detectFormat, parseJsxAst } from '../ast-helpers.ts';
import { cacheAst } from '../source-editor-lookup.ts';
import type { WrittenFile } from '../source-editor-service.ts';

const CSS_PROP_NAME_RE = /^[a-zA-Z-]+$/;

export type StylingProvider =
  StylingReport | ((projectRoot: string) => StylingReport | undefined) | undefined;

/** Folder for a CSS file Library blocks create (`styleFiles.newCssDir`); undefined = next to the JSX. */
export type NewCssDirProvider = ((projectRoot: string) => string | undefined) | undefined;

export function validateInsertedCss(rules: readonly InsertedCssRule[] | undefined): Result<void> {
  if (rules === undefined || rules.length === 0) return ok(undefined);
  for (const rule of rules) {
    const parsed = InsertedCssRuleSchema.safeParse(rule);
    if (!parsed.success) {
      return err({ code: 'E016', params: { reason: 'invalidCssRule' } });
    }
    for (const prop of Object.keys(rule.declarations)) {
      if (!CSS_PROP_NAME_RE.test(prop)) {
        return err({ code: 'E016', params: { reason: 'invalidCssProperty' } });
      }
    }
  }
  return ok(undefined);
}

function resolveStyling(projectRoot: string, provider: StylingProvider): StylingReport | undefined {
  return typeof provider === 'function' ? provider(projectRoot) : provider;
}

function collectTopLevelSelectors(css: string, file: string): Result<Set<string>> {
  try {
    const root = parseStylesheet(css, file);
    const selectors = new Set<string>();
    root.each((child) => {
      if (child.type === 'rule') {
        selectors.add(normalizeSelector(child.selector));
        for (const part of splitSelectorList(child.selector)) {
          selectors.add(normalizeSelector(part));
        }
      }
    });
    return ok(selectors);
  } catch {
    return err({ code: 'E024', params: { reason: 'cssParse' } });
  }
}

function appendMissingRules(
  cssBefore: string | undefined,
  cssFile: string,
  rules: readonly InsertedCssRule[],
  existing: Set<string>,
): Result<{ readonly cssAfter: string; readonly addedAny: boolean }> {
  let currentCss = cssBefore ?? '';
  let addedAny = false;
  for (const rule of rules) {
    const norm = normalizeSelector(rule.selector);
    if (existing.has(norm)) continue;
    existing.add(norm);
    const decls = Object.entries(rule.declarations).map(([property, value]) => ({
      property,
      value,
    }));
    if (decls.length === 0) continue;
    const nextRes = appendRule(currentCss, rule.selector, decls, undefined, cssFile);
    if (!nextRes.ok) return nextRes;
    currentCss = nextRes.value;
    addedAny = true;
  }
  return ok({ cssAfter: currentCss, addedAny });
}

export async function applyInsertedCssRules(
  fs: FileSystemPort,
  projectRoot: string,
  jsxFile: string,
  rules: readonly InsertedCssRule[],
  initialWrites: readonly WrittenFile[],
  stylingProvider?: StylingProvider,
  newCssDir?: NewCssDirProvider,
): Promise<Result<WrittenFile[]>> {
  const styling = resolveStyling(projectRoot, stylingProvider);
  const globalCssFile =
    primarySystem(styling) === 'cssModules'
      ? styling?.globalCss.find((file) => !file.includes('.module.'))
      : undefined;
  const winner = globalCssFile === undefined ? undefined : { file: globalCssFile };

  // Plan and compute everything first: nothing is written when the CSS cannot be read.
  const plan = await planCssFile({ fs }, projectRoot, jsxFile, winner, newCssDir?.(projectRoot));
  if (!plan.ok) return plan;
  const cssRead = await readFile(fs, projectRoot, plan.value.file);
  const cssBefore = cssRead.ok ? cssRead.value : undefined;
  const existing = collectTopLevelSelectors(cssBefore ?? '', plan.value.file);
  if (!existing.ok) return existing;
  const appended = appendMissingRules(cssBefore, plan.value.file, rules, existing.value);
  if (!appended.ok) return appended;

  const writes: WrittenFile[] = [...initialWrites];
  if (!appended.value.addedAny) return ok(mergeWrites(writes));
  const writtenCss = await writeFile(
    fs,
    projectRoot,
    plan.value.file,
    cssBefore,
    appended.value.cssAfter,
  );
  if (!writtenCss.ok) return writtenCss;
  writes.push(writtenCss.value);
  // The import goes in once the file exists, so Vite loads it on the first change.
  const imported = await addPlannedImport({ fs }, projectRoot, jsxFile, plan.value, writes);
  if (!imported.ok) return imported;
  if (imported.value !== undefined) {
    const { hasBom } = detectFormat(imported.value.after);
    const code = hasBom ? imported.value.after.slice(1) : imported.value.after;
    cacheAst(jsxFile, code, imported.value.afterHash, parseJsxAst(code));
  }
  return ok(mergeWrites(writes));
}

/** Puts back the files of an insert whose CSS step failed, so no edit is left without history. */
export async function restoreWrites(
  fs: FileSystemPort,
  projectRoot: string,
  files: readonly WrittenFile[],
): Promise<void> {
  for (const file of files) {
    if (file.before === undefined) await fs.remove(projectRoot, file.path);
    else await fs.writeTextAtomic(projectRoot, file.path, file.before);
  }
}

export type FinalizeCssInput = {
  readonly fs: FileSystemPort;
  readonly projectRoot: string;
  readonly sourceDir: string;
  readonly edit: StructureEdit;
  readonly targetRel: string | undefined;
  readonly onWritten?: ((files: readonly WrittenFile[]) => void) | undefined;
  readonly styling?: StylingProvider;
  readonly newCssDir?: NewCssDirProvider;
};

export async function finalizeWithCssIfNeeded(
  input: FinalizeCssInput,
  runLocked: (capture: (files: readonly WrittenFile[]) => void) => Promise<Result<StructureResult>>,
): Promise<Result<StructureResult>> {
  const { fs, projectRoot, edit, targetRel, onWritten, styling, newCssDir } = input;
  let writtenFiles: readonly WrittenFile[] = [];
  const res = await runLocked((files) => {
    writtenFiles = files;
  });
  if (!res.ok || !res.value.changed) return res;
  if (
    (edit.kind === 'insert' || edit.kind === 'wrapText') &&
    edit.css !== undefined &&
    edit.css.rules.length > 0 &&
    targetRel !== undefined
  ) {
    const cssRes = await applyInsertedCssRules(
      fs,
      projectRoot,
      targetRel,
      edit.css.rules,
      writtenFiles,
      styling,
      newCssDir,
    );
    if (!cssRes.ok) {
      await restoreWrites(fs, projectRoot, writtenFiles);
      return cssRes;
    }
    onWritten?.(cssRes.value);
    return ok({ ...res.value, files: cssRes.value.map((w) => w.path) });
  }
  onWritten?.(writtenFiles);
  return res;
}
