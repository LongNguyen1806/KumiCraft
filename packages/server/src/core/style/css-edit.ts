// Minimal text edits of a CSS/SCSS/Less file (SPEC-04 M-ST, R-ST-06, R-ST-09, QC-98): one declaration or one
// new rule changes; every other byte of the file stays as it was.
import { err, ok, type Result, splitSelectorList, type StyleState } from '@kumicraft/shared';
import type { AtRule, Container, Declaration, Root } from 'postcss';

import {
  findRule,
  findRuleByIndex,
  normalizeMedia,
  parseStylesheet,
  type RuleKey,
} from './css-locate.ts';
import { containerAt } from './source-map.ts';

export type CssDeclaration = { readonly property: string; readonly value: string };

export function findRuleBySelector(
  root: Root,
  selector: string,
  media?: string,
): Container | undefined {
  return findRule(root, {
    selector,
    media: media === undefined ? [] : [media],
    occurrence: 0,
  });
}

export type SelectorModifiers = {
  readonly state?: StyleState | undefined;
  readonly dark?: boolean | undefined;
  readonly groupSelector?: string | undefined;
  readonly cssModules?: boolean | undefined;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function hasDarkInSelector(selector: string): boolean {
  return /(?:^|\s)(?:\.dark|:global\(\.dark\))\s/.test(selector);
}

export function hasStateInSelector(
  selector: string,
  state: StyleState,
  groupSelector?: string,
): boolean {
  if (state === 'selected') {
    return /\[data-selected=["']?true["']?\]/.test(selector);
  }
  if (state === 'groupHover') {
    const grp = escapeRegex(groupSelector ?? '.group');
    return new RegExp(`(?:${grp}|:global\\(\\.group\\)):hover\\s`).test(selector);
  }
  return new RegExp(`(?<!:):${state}(?![\\w-])`).test(selector);
}

export function hasModifiersInSelector(selector: string, mods: SelectorModifiers): boolean {
  const stateOk =
    mods.state === undefined || hasStateInSelector(selector, mods.state, mods.groupSelector);
  const darkOk = mods.dark !== true || hasDarkInSelector(selector);
  return stateOk && darkOk;
}

function applySingleStateToPart(part: string, state: StyleState, mods: SelectorModifiers): string {
  if (hasStateInSelector(part, state, mods.groupSelector)) return part;
  if (state === 'selected') return `${part}[data-selected="true"]`;
  if (state === 'groupHover') {
    const grp =
      mods.cssModules && (mods.groupSelector === undefined || mods.groupSelector === '.group')
        ? ':global(.group)'
        : (mods.groupSelector ?? '.group');
    return `${grp}:hover ${part}`;
  }
  return `${part}:${state}`;
}

export function withModifiersSelector(selector: string, mods: SelectorModifiers): string {
  return splitSelectorList(selector)
    .map((part) => {
      const withState =
        mods.state !== undefined ? applySingleStateToPart(part, mods.state, mods) : part;
      if (mods.dark === true && !hasDarkInSelector(withState)) {
        const prefix = mods.cssModules ? ':global(.dark) ' : '.dark ';
        return `${prefix}${withState}`;
      }
      return withState;
    })
    .join(', ');
}

export function withStateSelector(selector: string, state: StyleState): string {
  // Top-level commas only: `:is(.a, .b)` is one part (R-ST-09).
  return withModifiersSelector(selector, { state });
}

function parse(css: string, file?: string): Result<Root> {
  try {
    return ok(parseStylesheet(css, file));
  } catch {
    return err({ code: 'E024', params: { reason: 'cssParse' } });
  }
}

function splice(text: string, start: number, end: number, insert: string): string {
  return text.slice(0, start) + insert + text.slice(end);
}

function eolOf(css: string): '\r\n' | '\n' {
  return css.includes('\r\n') ? '\r\n' : '\n';
}

/** Re-parses the result (PR-03): a write never leaves a CSS file that does not parse. */
function checked(css: string, file?: string): Result<string> {
  const parsed = parse(css, file);
  return parsed.ok ? ok(css) : parsed;
}

function lastDeclaration(container: Container, property: string): Declaration | undefined {
  let found: Declaration | undefined;
  container.each((child) => {
    if (child.type === 'decl' && child.prop.toLowerCase() === property) found = child;
  });
  return found;
}

function replaceDeclaration(css: string, decl: Declaration, value: string): string {
  const start = decl.source?.start?.offset ?? 0;
  const end = decl.source?.end?.offset ?? start;
  const semicolon = css.slice(start, end).trimEnd().endsWith(';') ? ';' : '';
  const important = decl.important ? ' !important' : '';
  return splice(
    css,
    start,
    end,
    `${decl.prop}${decl.raws.between ?? ': '}${value}${important}${semicolon}`,
  );
}

function removeDeclaration(css: string, decl: Declaration): string {
  const start = decl.source?.start?.offset ?? 0;
  const end = decl.source?.end?.offset ?? start;
  const before = typeof decl.raws.before === 'string' ? decl.raws.before : '';
  return splice(css, start - before.length, end, '');
}

/** A new declaration after the container's last child, laid out like it; `{}` gets an indented line. */
function addDeclaration(
  css: string,
  container: Container,
  property: string,
  value: string,
): string {
  const last = container.last;
  if (last === undefined) {
    const open = css.indexOf('{', container.source?.start?.offset ?? 0);
    const eol = eolOf(css);
    const indent = /[ \t]*$/.exec(css.slice(0, container.source?.start?.offset ?? 0))?.[0] ?? '';
    const close = (container.source?.end?.offset ?? open + 2) - 1;
    return splice(css, open + 1, close, `${eol}${indent}  ${property}: ${value};${eol}${indent}`);
  }
  const end = last.source?.end?.offset ?? 0;
  const needsSemicolon = last.type === 'decl' && !css.slice(0, end).trimEnd().endsWith(';');
  const before =
    typeof last.raws.before === 'string' && last.raws.before !== '' ? last.raws.before : ' ';
  return splice(css, end, end, `${needsSemicolon ? ';' : ''}${before}${property}: ${value};`);
}

export function applyDeclarationToRule(
  css: string,
  container: Container,
  property: string,
  value: string | undefined,
  file?: string,
): Result<string> {
  const decl = lastDeclaration(container, property);
  if (value === undefined) {
    return decl === undefined ? ok(css) : checked(removeDeclaration(css, decl), file);
  }
  return checked(
    decl === undefined
      ? addDeclaration(css, container, property, value)
      : replaceDeclaration(css, decl, value),
    file,
  );
}

/**
 * R-ST-06 `target: 'rule'`: sets (or with `value` undefined removes) `property` in the rule the
 * browser reported. An existing declaration of the same property changes in place; otherwise a
 * new one goes last, where it wins over a shorthand above it.
 */
export function setRuleDeclaration(
  css: string,
  key: RuleKey,
  property: string,
  value: string | undefined,
  file?: string,
): Result<string> {
  const root = parse(css, file);
  if (!root.ok) return root;
  const rule = findRule(root.value, key);
  if (rule === undefined) return err({ code: 'E016', params: { reason: 'ruleNotFound' } });
  return applyDeclarationToRule(css, rule, property, value, file);
}

/**
 * R-ST-06 `target: 'rule'` through a source map: sets (or removes) `property` in the block that
 * holds the declaration (or starts) at `at`, a nested `@media` of a Sass rule included.
 */
export function setDeclarationAtAnchor(
  css: string,
  at: { readonly line: number; readonly column: number },
  property: string,
  value: string | undefined,
  file?: string,
): Result<string> {
  const root = parse(css, file);
  if (!root.ok) return root;
  const block = containerAt(root.value, at);
  if (block === undefined) return err({ code: 'E016', params: { reason: 'ruleNotFound' } });
  return applyDeclarationToRule(css, block, property, value, file);
}

/**
 * R-ST-06 `target: 'rule'`: sets (or removes) `property` in the rule at 0-based `ruleIndex`
 * within the parsed stylesheet, preserving formatting.
 */
export function setDeclarationAt(
  css: string,
  ruleIndex: number,
  property: string,
  value: string | undefined,
  file?: string,
): Result<string> {
  const root = parse(css, file);
  if (!root.ok) return root;
  const rule = findRuleByIndex(root.value, ruleIndex);
  if (rule === undefined) return err({ code: 'E016', params: { reason: 'ruleNotFound' } });
  return applyDeclarationToRule(css, rule, property, value, file);
}

function topLevelMedia(root: Root, condition: string): AtRule | undefined {
  let found: AtRule | undefined;
  root.each((child) => {
    if (child.type === 'atrule' && child.name.toLowerCase() === 'media') {
      if (normalizeMedia(child.params) === normalizeMedia(condition)) found = child;
    }
  });
  return found;
}

function ruleText(
  selector: string,
  declarations: readonly CssDeclaration[],
  indent: string,
  eol: string,
): string {
  const body = declarations.map((d) => `${indent}  ${d.property}: ${d.value};`).join(eol);
  return `${indent}${selector} {${eol}${body}${eol}${indent}}`;
}

/**
 * R-ST-06 `target: 'element'`, R-ST-09: a new rule at the end of the file, or at the end of the
 * last top-level `@media` block with the same condition (a new block at the end when none).
 */
export function appendRule(
  css: string,
  selector: string,
  declarations: readonly CssDeclaration[],
  media?: string,
  file?: string,
): Result<string> {
  const root = parse(css, file);
  if (!root.ok) return root;
  const eol = eolOf(css);
  const block = media === undefined ? undefined : topLevelMedia(root.value, media);
  if (block !== undefined) {
    const close = (block.source?.end?.offset ?? css.length) - 1;
    const head = css.slice(0, close).trimEnd();
    return checked(
      `${head}${eol}${eol}${ruleText(selector, declarations, '  ', eol)}${eol}${css.slice(close)}`,
      file,
    );
  }
  const text =
    media === undefined
      ? ruleText(selector, declarations, '', eol)
      : `@media ${media} {${eol}${ruleText(selector, declarations, '  ', eol)}${eol}}`;
  const head = css.trimEnd();
  return checked(`${head}${head === '' ? '' : `${eol}${eol}`}${text}${eol}`, file);
}

export function upsertRuleDeclaration(
  css: string,
  selector: string,
  property: string,
  value: string | undefined,
  media?: string,
  file?: string,
): Result<string> {
  const root = parse(css, file);
  if (!root.ok) return root;
  const rule = findRuleBySelector(root.value, selector, media);
  if (rule !== undefined) {
    return applyDeclarationToRule(css, rule, property, value, file);
  }
  if (value === undefined) return ok(css);
  return appendRule(css, selector, [{ property, value }], media, file);
}
