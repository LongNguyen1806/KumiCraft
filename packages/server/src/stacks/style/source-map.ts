// Maps a rule of a compiled stylesheet back to the exact place in its source file through the
// source map Vite inlines (`css.devSourcemap`): Sass partials, nesting, `@extend`, PostCSS
// plugins and inlined `@import` included (SPEC-04 M-ST, R-ST-04, R-ST-06).
import { CSS_SHORTHANDS_OF } from '@kumicraft/shared';
import postcss, { type ChildNode, type Container, type Root } from 'postcss';

import { findRuleByIndex, isInsideGenerator } from './css-locate.ts';

/** A place in a source file; `file` is absolute, as the source map names it. */
export type SourcePosition = {
  readonly file: string;
  readonly line: number;
  readonly column: number;
};

export type MappedRule = {
  /** Where the rule starts in its source file. */
  readonly rule: SourcePosition;
  /** Where the declaration of the asked longhand (or its shorthand) is, when the rule has one. */
  readonly declaration?: SourcePosition | undefined;
};

type Located = { readonly source?: ChildNode['source'] };

function originOf(node: Located): SourcePosition | undefined {
  const start = node.source?.start;
  const input = node.source?.input;
  if (start === undefined || input === undefined) return undefined;
  const origin = input.origin(start.line, start.column);
  if (origin === false || origin.file === undefined) return undefined;
  return { file: origin.file, line: origin.line, column: origin.column };
}

function declarationFor(container: Container, longhand: string): Located | undefined {
  let found: Located | undefined;
  container.each((child) => {
    if (child.type !== 'decl') return;
    const prop = child.prop.toLowerCase();
    if (prop === longhand || CSS_SHORTHANDS_OF[longhand]?.includes(prop) === true) found = child;
  });
  return found;
}

/**
 * The source of rule `ruleIndex` (the Bridge's count of style rules in the sheet) of `compiled`,
 * the text the dev server serves for the sheet at `sheetPath`. Undefined without a source map.
 */
export function mapCompiledRule(
  compiled: string,
  sheetPath: string,
  ruleIndex: number,
  longhand: string,
): MappedRule | undefined {
  let root: Root;
  try {
    root = postcss.parse(compiled, { from: sheetPath });
  } catch {
    return undefined;
  }
  if (root.source?.input.map === undefined) return undefined;
  const container = findRuleByIndex(root, ruleIndex);
  if (container === undefined) return undefined;
  const rule = originOf(container);
  if (rule === undefined) return undefined;
  const decl = declarationFor(container, longhand);
  const declaration = decl === undefined ? undefined : originOf(decl);
  // A declaration from another file (a mixin in a partial) cannot be edited in this rule.
  return declaration?.file === rule.file ? { rule, declaration } : { rule };
}

/**
 * The block of declarations at `line`:`column` of a parsed source file: the rule (or nested
 * `@media`) that holds the declaration there, or the rule that starts there. Undefined when the
 * place is inside a mixin, function or loop, where one edit would change every use.
 */
export function containerAt(
  root: Root,
  position: { readonly line: number; readonly column: number },
): Container | undefined {
  let found: Container | undefined;
  root.walk((node) => {
    const start = node.source?.start;
    if (start?.line !== position.line || start.column !== position.column) return undefined;
    if (node.type === 'decl' && node.parent !== undefined && node.parent.type !== 'root') {
      found = node.parent;
    } else if (node.type === 'rule' || node.type === 'atrule') {
      found = node;
    }
    return found === undefined ? undefined : false;
  });
  return found === undefined || isInsideGenerator(found) ? undefined : found;
}
