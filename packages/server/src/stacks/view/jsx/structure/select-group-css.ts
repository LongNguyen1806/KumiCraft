// CSS / Sass / Less / Bootstrap selected-state splitting for SelectGroup (K9.8-1 TK-73).
import { posix } from 'node:path';

import type { StylingReport } from '@kumicraft/shared';
import type { Rule } from 'postcss';

import type { WrittenFile } from '../../../../kernel/editing.ts';
import { commitFileChanges } from '../../../../kernel/file-writer.ts';
import type { FileSystemPort } from '../../../../ports/file-system-port.ts';
import { upsertRuleDeclaration } from '../../../style/css-edit.ts';
import { parseStylesheet } from '../../../style/css-locate.ts';
import { computeSha256 } from '../source-editor-lookup.ts';

export type CssSelectSplit = {
  readonly perItemClassName: readonly string[];
  readonly selectedClassNames: readonly (string | undefined)[];
  readonly writtenCssFiles: readonly WrittenFile[];
};

const CSS_IMPORT_RE = /^\s*import\s+['"](\.[^'"]*\.(?:css|scss|sass|less))['"]\s*;?/gm;

function resolveRel(fromFile: string, spec: string): string {
  const dir = posix.dirname(fromFile.replace(/\\/g, '/'));
  return posix.normalize(dir === '.' ? spec : posix.join(dir, spec));
}

async function collectCandidateStylesheets(
  fs: FileSystemPort,
  root: string,
  jsxFile: string,
  jsxCode: string,
  styling?: StylingReport,
): Promise<string[]> {
  const files: string[] = [];
  for (const match of jsxCode.matchAll(CSS_IMPORT_RE)) {
    const spec = match[1];
    if (spec !== undefined && !spec.includes('.module.')) {
      const rel = resolveRel(jsxFile, spec);
      if (!files.includes(rel) && (await fs.exists(root, rel))) files.push(rel);
    }
  }
  for (const g of styling?.globalCss ?? []) {
    if (!files.includes(g) && (await fs.exists(root, g))) files.push(g);
  }
  return files;
}

function readDeclarationsForClass(
  cssText: string,
  file: string,
  cls: string,
): { readonly prop: string; readonly value: string }[] {
  const decls: { prop: string; value: string }[] = [];
  try {
    const root = parseStylesheet(cssText, file);
    root.walkRules((rule: Rule) => {
      if (rule.selector.trim() !== `.${cls}`) return;
      rule.walkDecls((d) => {
        decls.push({ prop: d.prop, value: d.value });
      });
    });
  } catch {
    return [];
  }
  return decls;
}

function splitClassTokens(classNames: readonly string[]): {
  readonly common: readonly string[];
  readonly selectedOnly: readonly string[];
  readonly unselectedDiff: readonly string[];
} {
  const lists = classNames.map((c) => c.split(/\s+/).filter(Boolean));
  const first = lists[0] ?? [];
  const rest = lists.slice(1);
  if (rest.length === 0) return { common: first, selectedOnly: [], unselectedDiff: [] };
  const restCommon = rest[0]?.filter((t) => rest.every((r) => r.includes(t))) ?? [];
  const common = first.filter((t) => restCommon.includes(t));
  const selectedOnly = first.filter((t) => !restCommon.includes(t));
  const unselectedDiff = restCommon.filter((t) => !first.includes(t));
  return { common, selectedOnly, unselectedDiff };
}

type SelectedDeclarations = {
  readonly extractedDecls: readonly { readonly prop: string; readonly value: string }[];
  readonly targetSheet: { readonly path: string; readonly before: string } | undefined;
};

/** The declarations of the classes only the chosen item has, and the first sheet that holds them. */
async function readSelectedDeclarations(
  fs: FileSystemPort,
  root: string,
  sheets: readonly string[],
  selectedOnly: readonly string[],
): Promise<SelectedDeclarations> {
  const extractedDecls: { prop: string; value: string }[] = [];
  let targetSheet: SelectedDeclarations['targetSheet'];
  for (const sheetPath of sheets) {
    const read = await fs.readText(root, sheetPath, { maxBytes: 1024 * 1024 });
    if (!read.ok) continue;
    for (const selCls of selectedOnly) {
      const found = readDeclarationsForClass(read.value, sheetPath, selCls);
      if (found.length > 0) {
        extractedDecls.push(...found);
        targetSheet ??= { path: sheetPath, before: read.value };
      }
    }
  }
  return { extractedDecls, targetSheet };
}

/** The sheet with the selected item's declarations under `.anchor[data-selected="true"]`. */
function withSelectedRule(
  sheet: { readonly path: string; readonly before: string },
  anchorClass: string,
  decls: readonly { readonly prop: string; readonly value: string }[],
): string {
  let css = sheet.before;
  const selector = `.${anchorClass}[data-selected="true"]`;
  for (const decl of decls) {
    const updated = upsertRuleDeclaration(
      css,
      selector,
      decl.prop,
      decl.value,
      undefined,
      sheet.path,
    );
    if (updated.ok) css = updated.value;
  }
  return css;
}

async function writeSelectedCssRule(options: {
  readonly fs: FileSystemPort;
  readonly root: string;
  readonly sheets: readonly string[];
  readonly selectedOnly: readonly string[];
  readonly sharedBase: readonly string[];
  readonly classCount: number;
}): Promise<CssSelectSplit | undefined> {
  const { fs, root, sheets, selectedOnly, sharedBase, classCount } = options;
  const { extractedDecls, targetSheet } = await readSelectedDeclarations(
    fs,
    root,
    sheets,
    selectedOnly,
  );
  if (extractedDecls.length === 0 || targetSheet === undefined) return undefined;
  const anchorClass = sharedBase[0] ?? 'kc-select-item';
  const finalBase = sharedBase.includes(anchorClass) ? sharedBase : [...sharedBase, anchorClass];
  const nextCss = withSelectedRule(targetSheet, anchorClass, extractedDecls);
  if (nextCss === targetSheet.before) return undefined;
  const w = await commitFileChanges({ fs }, root, [
    { path: targetSheet.path, before: targetSheet.before, after: nextCss },
  ]);
  if (!w.ok) return undefined;
  const joined = finalBase.join(' ');
  const { path: cssPath, before } = targetSheet;
  return {
    perItemClassName: Array.from({ length: classCount }, () => joined),
    selectedClassNames: Array.from({ length: classCount }, () => undefined),
    writtenCssFiles: [
      {
        path: cssPath,
        before,
        after: nextCss,
        beforeHash: computeSha256(before),
        afterHash: computeSha256(nextCss),
      },
    ],
  };
}

export async function splitCssSelectClasses(options: {
  readonly fs: FileSystemPort;
  readonly root: string;
  readonly jsxFile: string;
  readonly jsxCode: string;
  readonly classNames: readonly string[];
  readonly styling?: StylingReport | undefined;
}): Promise<CssSelectSplit> {
  const { fs, root, jsxFile, jsxCode, classNames, styling } = options;
  const { common, selectedOnly, unselectedDiff } = splitClassTokens(classNames);
  const sharedBase = [...common, ...unselectedDiff];
  if (selectedOnly.length === 0) {
    const joined = sharedBase.join(' ');
    return {
      perItemClassName: classNames.map(() => joined),
      selectedClassNames: classNames.map(() => undefined),
      writtenCssFiles: [],
    };
  }
  const sheets = await collectCandidateStylesheets(fs, root, jsxFile, jsxCode, styling);
  const cssSplit = await writeSelectedCssRule({
    fs,
    root,
    sheets,
    selectedOnly,
    sharedBase,
    classCount: classNames.length,
  });
  if (cssSplit !== undefined) return cssSplit;
  const baseJoined = sharedBase.join(' ');
  const selJoined = selectedOnly.join(' ');
  return {
    perItemClassName: classNames.map(() => baseJoined),
    selectedClassNames: classNames.map(() => selJoined),
    writtenCssFiles: [],
  };
}
