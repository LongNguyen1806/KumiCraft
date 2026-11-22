// Maps a rule the browser reports back to its line in a CSS/SCSS/Less file (SPEC-04 M-ST, R-ST-04, ADR-BE-35).
import { posix } from 'node:path';

import { CSS_SHORTHANDS_OF, type RelPath, splitSelectorList } from '@kumicraft/shared';
import postcss, { type AtRule, type Container, type Root, type Rule } from 'postcss';
import postcssLess from 'postcss-less';
import postcssScss from 'postcss-scss';

import type { FileSystemPort } from '../../ports/file-system-port.ts';

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

export function parseStylesheet(text: string, file?: string): Root {
  if (file !== undefined) {
    if (/\.(scss|sass)$/i.test(file)) {
      return postcssScss.parse(text);
    }
    if (/\.less$/i.test(file)) {
      const parsed = postcssLess.parse(text);
      // Only syntaxes for CSS inside HTML return a Document; Less always gives a Root. Callers
      // already treat a parse failure as "no rule found".
      if (parsed.type === 'root') return parsed;
      throw new Error('postcss-less returned a document');
    }
  }
  return postcss.parse(text);
}

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

const FORBIDDEN_ATRULES = new Set(['mixin', 'function', 'each', 'for', 'while', 'if', 'else']);
const LESS_MIXIN_DEF_RE = /^[.#][\w-]+\s*\(/;

function isForbiddenSelector(selector: string): boolean {
  return (
    selector.includes('#{') || selector.includes('@{') || LESS_MIXIN_DEF_RE.test(selector.trim())
  );
}

function isRule(node: { type: string } | undefined): node is Rule {
  return node !== undefined && node.type === 'rule';
}

function isAtRule(node: { type: string } | undefined): node is AtRule {
  return node !== undefined && node.type === 'atrule';
}

function isKeyframes(name: string): boolean {
  return /keyframes$/i.test(name);
}

/**
 * Whether `node` is (or sits in) a Sass mixin, function, loop or condition, or a Less mixin
 * definition: one edit there changes every place that uses it, so it is never edited in place.
 */
export function isInsideGenerator(node: Container): boolean {
  let curr: Container['parent'] | Container = node;
  while (curr !== undefined && curr.type !== 'root' && curr.type !== 'document') {
    if (isAtRule(curr) && FORBIDDEN_ATRULES.has(curr.name.toLowerCase())) return true;
    if (isRule(curr) && isForbiddenSelector(curr.selector)) return true;
    curr = curr.parent;
  }
  return false;
}

/**
 * Resolves nested selectors for SCSS/Less rules, cross-multiplying parent & child selector lists.
 * Returns undefined if inside mixins, loops, or has interpolations #{} / @{}.
 */
export function resolvedSelector(rule: Rule): string | undefined {
  if (isForbiddenSelector(rule.selector)) {
    return undefined;
  }

  const stack: Rule[] = [rule];
  let curr = rule.parent;
  while (curr !== undefined && curr.type !== 'root') {
    if (isAtRule(curr)) {
      const atName = curr.name.toLowerCase();
      if (FORBIDDEN_ATRULES.has(atName)) {
        return undefined;
      }
    } else if (isRule(curr)) {
      if (isForbiddenSelector(curr.selector)) {
        return undefined;
      }
      stack.unshift(curr);
    }
    curr = curr.parent;
  }

  const first = stack[0];
  if (first === undefined) return undefined;
  let currentList = splitSelectorList(first.selector);

  for (let i = 1; i < stack.length; i++) {
    const childRule = stack[i];
    if (childRule === undefined) continue;
    const childList = splitSelectorList(childRule.selector);
    const nextList: string[] = [];

    for (const parentSel of currentList) {
      for (const childSel of childList) {
        if (childSel.includes('&')) {
          nextList.push(childSel.replace(/&/g, parentSel.trim()).trim());
        } else {
          nextList.push(`${parentSel.trim()} ${childSel.trim()}`);
        }
      }
    }
    currentList = nextList;
  }

  return currentList.join(', ');
}

export type RuleTarget = {
  readonly container: Container;
  readonly selector: string;
  readonly media: readonly string[];
};

/**
 * Every rule of `container` with the `@media` conditions around it, outermost first.
 * Recurses into nested rules and nested atrules without cloning AST nodes.
 */
export function walkRulesWithMedia(
  container: Container,
  media: readonly string[],
  visit: (target: RuleTarget) => boolean,
): boolean {
  let stopped = false;
  container.each((child) => {
    if (stopped) return false;
    if (isRule(child)) {
      const resSel = resolvedSelector(child);
      if (resSel !== undefined) {
        stopped = visit({ container: child, selector: resSel, media });
      }
      if (!stopped) {
        stopped = walkRulesWithMedia(child, media, visit);
      }
    } else if (isAtRule(child) && child.nodes !== undefined && !isKeyframes(child.name)) {
      const isMedia = child.name.toLowerCase() === 'media';
      const inner = isMedia ? [...media, normalizeMedia(child.params)] : media;
      if (isMedia && isRule(container)) {
        const resParent = resolvedSelector(container);
        const hasDirectDecls = child.nodes.some((n) => n.type === 'decl');
        if (hasDirectDecls && resParent !== undefined) {
          stopped = visit({ container: child, selector: resParent, media: inner });
        }
      }
      if (!stopped) {
        stopped = walkRulesWithMedia(child, inner, visit);
      }
    }
    return stopped ? false : undefined;
  });
  return stopped;
}

function declarationLines(
  container: Container,
  longhands: readonly string[],
): Record<string, number> {
  const lines: Record<string, number> = {};
  container.each((child) => {
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

/** The `targetIndex`-th rule of a parsed sheet (0-based), traversing nested rules. */
export function findRuleByIndex(root: Container, targetIndex: number): Container | undefined {
  if (targetIndex < 0) return undefined;
  let current = 0;
  let found: Container | undefined;
  walkRulesWithMedia(root, [], (target) => {
    if (current === targetIndex) {
      found = target.container;
      return true;
    }
    current++;
    return false;
  });
  return found;
}

/**
 * Finds the `occurrence`-th rule of a parsed sheet with this selector under this `@media` chain.
 * Compares against resolvedSelector for nested SCSS/Less rules.
 */
function findRuleTarget(root: Container, key: RuleKey): RuleTarget | undefined {
  const selector = normalizeSelector(key.selector);
  const media = key.media.map(normalizeMedia).join('|');
  let seen = 0;
  let found: RuleTarget | undefined;
  walkRulesWithMedia(root, [], (target) => {
    if (normalizeSelector(target.selector) !== selector || target.media.join('|') !== media) {
      return false;
    }
    if (seen++ !== key.occurrence) return false;
    found = target;
    return true;
  });
  return found;
}

export function findRule(root: Container, key: RuleKey): Container | undefined {
  return findRuleTarget(root, key)?.container;
}

/**
 * Finds the `index`-th rule of `css` (0-based) and returns its line, declaration lines,
 * and source selector.
 */
export function locateRuleByIndex(
  css: string,
  index: number,
  longhands: readonly string[],
  file?: string,
): (LocatedRule & { readonly selector: string }) | undefined {
  let root: Root;
  try {
    root = parseStylesheet(css, file);
  } catch {
    return undefined;
  }
  let current = 0;
  let found: RuleTarget | undefined;
  walkRulesWithMedia(root, [], (target) => {
    if (current === index) {
      found = target;
      return true;
    }
    current++;
    return false;
  });
  if (found === undefined) return undefined;
  return {
    line: found.container.source?.start?.line ?? 1,
    declarations: declarationLines(found.container, longhands),
    selector: found.selector,
  };
}

/**
 * Finds the `occurrence`-th rule of `css` with this selector under this `@media` chain.
 */
export function locateRule(
  css: string,
  key: RuleKey,
  longhands: readonly string[],
  file?: string,
): LocatedRule | undefined {
  let root: Root;
  try {
    root = parseStylesheet(css, file);
  } catch {
    return undefined;
  }
  const rule = findRule(root, key);
  if (rule === undefined) return undefined;
  return { line: rule.source?.start?.line ?? 1, declarations: declarationLines(rule, longhands) };
}

function candidatePaths(baseDir: string, spec: string, isLess: boolean): string[] {
  const clean = spec.replace(/['"]/g, '').trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) return [];

  const joinPath = (p1: string, p2: string) =>
    posix.normalize(p1.length > 0 ? `${p1}/${p2}` : p2).replace(/\\/g, '/');

  if (isLess) {
    if (clean.endsWith('.less')) return [joinPath(baseDir, clean)];
    return [joinPath(baseDir, `${clean}.less`), joinPath(baseDir, `${clean}/index.less`)];
  }

  if (clean.endsWith('.scss') || clean.endsWith('.sass')) {
    return [joinPath(baseDir, clean)];
  }
  const lastSlash = clean.lastIndexOf('/');
  const prefix = lastSlash >= 0 ? clean.slice(0, lastSlash + 1) : '';
  const name = lastSlash >= 0 ? clean.slice(lastSlash + 1) : clean;

  return [
    joinPath(baseDir, `${prefix}_${name}.scss`),
    joinPath(baseDir, `${prefix}${name}.scss`),
    joinPath(baseDir, `${clean}/_index.scss`),
    joinPath(baseDir, `${clean}/index.scss`),
    joinPath(baseDir, `${prefix}_${name}.sass`),
    joinPath(baseDir, `${prefix}${name}.sass`),
  ];
}

export type RuleSourceResult = {
  readonly file: RelPath;
  readonly line: number;
  readonly selector: string;
  readonly rule: Container;
};

const STYLE_IMPORT_RE = /@(?:use|import|forward)\s+['"]([^'"]+)['"]/g;

/** Files a SCSS/Less file pulls in with `@use`, `@import`, `@forward`, as candidate project paths. */
function importedStyleFiles(text: string, file: string): string[] {
  const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';
  const isLess = file.endsWith('.less');
  return [...text.matchAll(STYLE_IMPORT_RE)].flatMap((m) =>
    candidatePaths(dir, m[1] ?? '', isLess),
  );
}

/**
 * Searches for a rule in entryFile and files it imports via @use / @import / @forward
 * up to 2 levels deep (max 20 files).
 */
export async function findRuleSource(
  fs: FileSystemPort,
  root: string,
  entryFile: string,
  ruleKey: RuleKey,
): Promise<RuleSourceResult | undefined> {
  const queue: { file: string; depth: number }[] = [{ file: entryFile, depth: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0 && visited.size < 20) {
    const item = queue.shift();
    if (item === undefined) break;
    const file = item.file.replaceAll('\\', '/');
    if (visited.has(file)) continue;
    visited.add(file);

    const read = await fs.readText(root, file, { maxBytes: 1024 * 1024 });
    if (!read.ok) continue;
    let stylesheet: Root;
    try {
      stylesheet = parseStylesheet(read.value, file);
    } catch {
      continue;
    }

    const matched = findRuleTarget(stylesheet, ruleKey);
    if (matched !== undefined) {
      const line = matched.container.source?.start?.line ?? 1;
      return { file, line, selector: matched.selector, rule: matched.container };
    }
    if (item.depth < 2) {
      for (const next of importedStyleFiles(read.value, file)) {
        if (!visited.has(next)) queue.push({ file: next, depth: item.depth + 1 });
      }
    }
  }
  return undefined;
}
