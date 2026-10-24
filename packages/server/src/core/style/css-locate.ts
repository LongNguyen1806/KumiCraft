// Maps a rule the browser reports back to its line in a CSS file (SPEC-04 M-ST, R-ST-04, ADR-BE-35).
import { CSS_SHORTHANDS_OF } from '@kumicraft/shared';
import postcss, { type Container, type Rule } from 'postcss';

export type RuleKey = {
  readonly selector: string;
  readonly media: readonly string[];
  readonly occurrence: number;
};

export type LocatedRule = {
  readonly line: number;
  /** Line of the declaration that sets each asked longhand, the last one in the rule. */
  readonly declarations: Readonly<Record<string, number>>;
};

/** Browsers re-print selectors (`a>b` as `a > b`); compare without layout spaces. */
export function normalizeSelector(selector: string): string {
  return selector
    .replace(/\s+/g, ' ')
    .replace(/\s*([>+~,])\s*/g, '$1')
    .trim();
}

export function normalizeMedia(media: string): string {
  return media.replace(/\s+/g, '').toLowerCase();
}

/**
 * Every rule of `container` with the `@media` conditions around it, outermost first. `@keyframes`
 * steps are not style rules (the browser's `ruleIndex` skips them too).
 */
export function walkRulesWithMedia(
  container: Container,
  media: readonly string[],
  visit: (rule: Rule, media: readonly string[]) => boolean,
): boolean {
  let stopped = false;
  container.each((child) => {
    if (stopped) return false;
    if (child.type === 'rule') stopped = visit(child, media);
    else if (child.type === 'atrule' && child.nodes !== undefined && !isKeyframes(child.name)) {
      const inner =
        child.name.toLowerCase() === 'media' ? [...media, normalizeMedia(child.params)] : media;
      stopped = walkRulesWithMedia(child, inner, visit);
    }
    return stopped ? false : undefined;
  });
  return stopped;
}

function isKeyframes(name: string): boolean {
  return /keyframes$/i.test(name);
}

function declarationLines(rule: Rule, longhands: readonly string[]): Record<string, number> {
  const lines: Record<string, number> = {};
  rule.each((child) => {
    if (child.type !== 'decl') return;
    const decl = child;
    const prop = decl.prop.toLowerCase();
    for (const longhand of longhands) {
      if (prop === longhand || CSS_SHORTHANDS_OF[longhand]?.includes(prop) === true) {
        lines[longhand] = decl.source?.start?.line ?? 0;
      }
    }
  });
  return lines;
}

/** The `targetIndex`-th rule of a parsed sheet (0-based), traversing nested at-rules. */
export function findRuleByIndex(root: Container, targetIndex: number): Rule | undefined {
  if (targetIndex < 0) return undefined;
  let current = 0;
  let found: Rule | undefined;
  walkRulesWithMedia(root, [], (rule) => {
    if (current === targetIndex) {
      found = rule;
      return true;
    }
    current++;
    return false;
  });
  return found;
}

/**
 * Finds the `occurrence`-th rule of a parsed sheet with this selector under this `@media` chain.
 */
export function findRule(root: Container, key: RuleKey): Rule | undefined {
  const selector = normalizeSelector(key.selector);
  const media = key.media.map(normalizeMedia).join('|');
  let seen = 0;
  let found: Rule | undefined;
  walkRulesWithMedia(root, [], (rule, chain) => {
    if (normalizeSelector(rule.selector) !== selector || chain.join('|') !== media) return false;
    if (seen++ !== key.occurrence) return false;
    found = rule;
    return true;
  });
  return found;
}

/**
 * Finds the `index`-th rule of `css` (0-based) and returns its line, declaration lines,
 * and source selector.
 */
export function locateRuleByIndex(
  css: string,
  index: number,
  longhands: readonly string[],
): (LocatedRule & { readonly selector: string }) | undefined {
  let root;
  try {
    root = postcss.parse(css);
  } catch {
    return undefined;
  }
  const rule = findRuleByIndex(root, index);
  if (rule === undefined) return undefined;
  return {
    line: rule.source?.start?.line ?? 1,
    declarations: declarationLines(rule, longhands),
    selector: rule.selector,
  };
}

/**
 * Finds the `occurrence`-th rule of `css` with this selector under this `@media` chain, the way
 * the browser counted them. Undefined when the file has no such rule (it was generated, or the
 * file changed since the page loaded) or does not parse.
 */
export function locateRule(
  css: string,
  key: RuleKey,
  longhands: readonly string[],
): LocatedRule | undefined {
  let root;
  try {
    root = postcss.parse(css);
  } catch {
    return undefined;
  }
  const rule = findRule(root, key);
  if (rule === undefined) return undefined;
  return { line: rule.source?.start?.line ?? 1, declarations: declarationLines(rule, longhands) };
}
