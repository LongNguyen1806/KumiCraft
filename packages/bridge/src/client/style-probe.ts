// Rules of the page that style one element, in cascade order (SPEC-04 M-ST, R-ST-04, ADR-BE-35).
// The browser knows the cascade; the server only maps each rule back to its file.
import {
  type BridgeStyleProbePayload,
  CSS_SHORTHANDS_OF,
  type MatchedRule,
  type StudioStyleProbePayload,
  type StyleDeclaration,
  type StyleSheetRef,
} from '@reactcraft/shared';

const MAX_RULES = 100;

type Specificity = readonly [number, number, number];

type Candidate = {
  readonly rule: Omit<MatchedRule, 'affects'>;
  readonly specificity: Specificity;
  /** Document order of the rule across all sheets: a later rule wins a tie. */
  readonly position: number;
};

/** Splits a selector list on its top-level commas (not those inside `:is(a, b)` or `[x="a,b"]`). */
export function splitSelectorList(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const ch = list[i];
    if (quote !== undefined) {
      if (ch === quote) quote = undefined;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(list.slice(start).trim());
  return parts.filter((p) => p !== '');
}

function maxSpecificity(list: readonly Specificity[]): Specificity {
  return list.reduce<Specificity>((best, s) => (compare(s, best) > 0 ? s : best), [0, 0, 0]);
}

/** Selectors Level 4 specificity of one complex selector: (ids, classes, types). */
export function selectorSpecificity(selector: string): Specificity {
  let a = 0;
  let b = 0;
  let c = 0;
  let rest = selector.replace(/"[^"]*"|'[^']*'/g, '""');
  // :is(), :not(), :has() count as their most specific argument; :where() counts nothing.
  rest = rest.replace(/:(is|not|has|where)\(([^()]*)\)/g, (_m, name: string, args: string) => {
    if (name !== 'where') {
      const inner = maxSpecificity(splitSelectorList(args).map(selectorSpecificity));
      a += inner[0];
      b += inner[1];
      c += inner[2];
    }
    return ' ';
  });
  a += (rest.match(/#[\w-]+/g) ?? []).length;
  b += (rest.match(/\.[\w-]+|\[[^\]]*\]|(?<!:):(?!:)[\w-]+(\([^)]*\))?/g) ?? []).length;
  c += (rest.match(/::[\w-]+|(?:^|[\s>+~(])[a-zA-Z][\w-]*/g) ?? []).length;
  return [a, b, c];
}

function compare(x: Specificity, y: Specificity): number {
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

function sheetRefOf(sheet: CSSStyleSheet): StyleSheetRef {
  const owner = sheet.ownerNode;
  const viteId = owner instanceof Element ? (owner.getAttribute('data-vite-dev-id') ?? '') : '';
  if (viteId !== '') return { kind: 'module', id: viteId };
  const href = sheet.href ?? '';
  return href === '' ? { kind: 'inline' } : { kind: 'link', href };
}

function declarationsOf(
  style: CSSStyleDeclaration,
  properties: readonly string[],
): StyleDeclaration[] {
  const found: StyleDeclaration[] = [];
  for (const property of properties) {
    // A shorthand with var() leaves its longhands empty in the CSSOM: report the shorthand's text.
    const name = [property, ...(CSS_SHORTHANDS_OF[property] ?? [])].find(
      (p) => style.getPropertyValue(p).trim() !== '',
    );
    if (name === undefined) continue;
    const value = style.getPropertyValue(name).trim();
    found.push({ property, value, important: style.getPropertyPriority(name) === 'important' });
  }
  return found;
}

function matchingSpecificity(el: Element, selectorText: string): Specificity | undefined {
  const matching = splitSelectorList(selectorText).filter((part) => {
    try {
      return el.matches(part);
    } catch {
      return false;
    }
  });
  return matching.length === 0 ? undefined : maxSpecificity(matching.map(selectorSpecificity));
}

type WalkState = {
  readonly el: Element;
  readonly properties: readonly string[];
  readonly view: Window;
  readonly sheet: StyleSheetRef;
  /** Rules seen so far per `selector|media`, matched or not, so `occurrence` counts as in the file. */
  readonly seen: Map<string, number>;
  readonly out: Candidate[];
  position: number;
  /** 0-based index of CSSStyleRule within its stylesheet (R-ST-08). */
  ruleIndex: number;
};

function visitStyleRule(state: WalkState, rule: CSSStyleRule, media: readonly string[]): void {
  const key = `${rule.selectorText}|${media.join('|')}`;
  const occurrence = state.seen.get(key) ?? 0;
  state.seen.set(key, occurrence + 1);
  const ruleIndex = state.ruleIndex;
  state.ruleIndex++;
  state.position++;
  const specificity = matchingSpecificity(state.el, rule.selectorText);
  if (specificity === undefined) return;
  const declarations = declarationsOf(rule.style, state.properties);
  if (declarations.length === 0) return;
  state.out.push({
    rule: {
      sheet: state.sheet,
      selector: rule.selectorText,
      media: [...media],
      occurrence,
      ruleIndex,
      declarations,
    },
    specificity,
    position: state.position,
  });
}

/** A rule under a `@media` that does not apply still counts for `occurrence`. */
function countUnmatched(state: WalkState, selector: string, media: readonly string[]): void {
  const key = `${selector}|${media.join('|')}`;
  state.seen.set(key, (state.seen.get(key) ?? 0) + 1);
  state.ruleIndex++;
  state.position++;
}

function walkRules(
  state: WalkState,
  rules: CSSRuleList,
  media: readonly string[],
  applies: boolean,
): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      if (applies) visitStyleRule(state, rule, media);
      else countUnmatched(state, rule.selectorText, media);
    } else if (rule instanceof CSSMediaRule) {
      const condition = rule.media.mediaText;
      const matches = applies && state.view.matchMedia(condition).matches;
      walkRules(state, rule.cssRules, [...media, condition], matches);
    } else if (rule instanceof CSSGroupingRule) {
      // @supports, @layer, @container: their rules count as in the parent block.
      walkRules(state, rule.cssRules, media, applies);
    }
  }
}

function countMatches(doc: Document, selector: string): number {
  try {
    return doc.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

/** R-ST-04: every page rule that declares one of `properties` for `el`, the cascade winner first. */
export function probeStyles(
  el: Element,
  properties: readonly string[],
): Omit<BridgeStyleProbePayload, 'ref' | 'found'> {
  const doc = el.ownerDocument;
  const view = doc.defaultView ?? window;
  const out: Candidate[] = [];
  let position = 0;
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // a cross-origin stylesheet cannot be read
    }
    const state: WalkState = {
      el,
      properties,
      view,
      sheet: sheetRefOf(sheet),
      seen: new Map(),
      out,
      position,
      ruleIndex: 0,
    };
    walkRules(state, rules, [], true);
    position = state.position;
  }
  out.sort((x, y) => compare(y.specificity, x.specificity) || y.position - x.position);
  const computed = view.getComputedStyle(el);
  const style =
    el instanceof view.HTMLElement || el instanceof view.SVGElement ? el.style : undefined;
  return {
    rules: out
      .slice(0, MAX_RULES)
      .map((c) => ({ ...c.rule, affects: countMatches(doc, c.rule.selector) })),
    inline: style === undefined ? [] : declarationsOf(style, properties),
    computed: Object.fromEntries(properties.map((p) => [p, computed.getPropertyValue(p).trim()])),
  };
}

/** `style-probe` from Studio: an element that is not on the page answers `found: false`. */
export function answerStyleProbe(
  request: StudioStyleProbePayload,
  doc: Document,
): BridgeStyleProbePayload {
  const el = doc.querySelectorAll(`[data-rc-loc="${request.ref.loc}"]`)[request.ref.index];
  if (el === undefined)
    return { ref: request.ref, found: false, rules: [], inline: [], computed: {} };
  return { ref: request.ref, found: true, ...probeStyles(el, request.properties) };
}
