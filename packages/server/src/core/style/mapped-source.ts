// Where a rule the browser applies comes from, read through the dev server's source map; shared
// by reading (Inspector source) and writing (R-ST-04, R-ST-06). Undefined means "no map": the
// caller falls back to finding the rule by selector.
import type { MatchedRule } from '@kumicraft/shared';

import type { CompiledCssPort } from '../ports/compiled-css-port.ts';
import type { FileSystemPort } from '../ports/file-system-port.ts';
import { parseStylesheet } from './css-locate.ts';
import { projectFileOf } from './project-file.ts';
import { containerAt, mapCompiledRule } from './source-map.ts';

const MAX_CSS_BYTES = 2 * 1024 * 1024;

export type MappedSource =
  | {
      readonly kind: 'project';
      readonly file: string;
      /** Line and column of the declaration (or the rule) in `file`, to find it again for editing. */
      readonly anchor: { readonly line: number; readonly column: number };
      /** False inside a mixin, function or loop. */
      readonly editable: boolean;
    }
  | { readonly kind: 'external'; readonly href: string };

export type MappedSourceDeps = {
  readonly fs: FileSystemPort;
  readonly compiledCss?: CompiledCssPort | undefined;
};

/** Compiled text per sheet id, so one Inspector read fetches each sheet once. */
export type CompiledCache = Map<string, string | undefined>;

export async function locateBySourceMap(
  deps: MappedSourceDeps,
  root: string,
  rule: MatchedRule,
  longhand: string,
  cache: CompiledCache = new Map(),
): Promise<MappedSource | undefined> {
  if (rule.sheet.kind !== 'module' || deps.compiledCss === undefined) return undefined;
  const id = rule.sheet.id;
  const sheetPath = id.split('?')[0] ?? id;
  // CSS Modules keep finding rules by their order in the file (R-ST-08).
  if (/\.module\.\w+$/.test(sheetPath)) return undefined;
  if (!cache.has(id)) cache.set(id, await deps.compiledCss.read(id));
  const compiled = cache.get(id);
  if (compiled === undefined) return undefined;
  const mapped = mapCompiledRule(compiled, sheetPath, rule.ruleIndex, longhand);
  if (mapped === undefined) return undefined;
  const place = mapped.declaration ?? mapped.rule;
  const file = projectFileOf(root, place.file);
  if (file === undefined) return { kind: 'external', href: place.file };
  const anchor = { line: place.line, column: place.column };
  const source = await deps.fs.readText(root, file, { maxBytes: MAX_CSS_BYTES });
  if (!source.ok) return undefined;
  try {
    const editable = containerAt(parseStylesheet(source.value, file), anchor) !== undefined;
    return { kind: 'project', file, anchor, editable };
  } catch {
    return undefined;
  }
}
