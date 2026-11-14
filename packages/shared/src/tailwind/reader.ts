// readValue implementation conforming to R-TW-04 and R-TW-07.
import { type Breakpoint, type InteractionState, parseBreakpointValue } from '../responsive.ts';
import { SPACING_FAMILIES } from './properties.ts';
import type { ClassContext, ClassToken, ClassValue, PropertyId, Scope } from './types.ts';

const RESPONSIVE_KEYS_LIST = ['sm', 'md', 'lg', 'xl', '2xl'];

const VARIANT_TO_STATE: Readonly<Record<string, InteractionState>> = {
  hover: 'hover',
  active: 'active',
  focus: 'focus',
  disabled: 'disabled',
  'group-hover': 'groupHover',
  'data-[selected=true]': 'selected',
};

function getThreshold(key: string, ctx: ClassContext): number {
  if (key in ctx.breakpoints) {
    const val = ctx.breakpoints[key];
    if (val !== undefined) return val;
  }
  const themeBp = ctx.theme.breakpoints.find(
    (b) => b.name === key || b.name === `--breakpoint-${key}`,
  );
  if (themeBp !== undefined) {
    const parsed = parseBreakpointValue(themeBp.value);
    if (parsed !== undefined) return parsed;
  }
  return 0;
}

function isResponsiveVariant(v: string, ctx?: ClassContext): boolean {
  const clean = v.startsWith('max-') ? v.slice(4) : v;
  if (RESPONSIVE_KEYS_LIST.includes(clean)) return true;
  if (ctx && clean in ctx.breakpoints) return true;
  return (
    ctx?.theme.breakpoints.some((b) => b.name === clean || b.name === `--breakpoint-${clean}`) ??
    false
  );
}

function getVariantsInfo(
  token: ClassToken,
  ctx?: ClassContext,
): {
  readonly resp?: string | undefined;
  readonly state?: InteractionState | undefined;
  readonly dark: boolean;
} {
  let resp: string | undefined;
  let state: InteractionState | undefined;
  let dark = false;
  for (const v of token.variants) {
    if (v === 'dark') {
      dark = true;
    } else if (v in VARIANT_TO_STATE) {
      state = VARIANT_TO_STATE[v];
    } else if (isResponsiveVariant(v, ctx)) {
      resp = v;
    }
  }
  return { resp, state, dark };
}

type ReadView = {
  readonly width: number;
  readonly state?: InteractionState | undefined;
  readonly dark?: boolean | undefined;
};

function appliesToView(token: ClassToken, view: ReadView, ctx: ClassContext): boolean {
  const { resp, state, dark } = getVariantsInfo(token, ctx);
  if (state !== undefined && state !== view.state) {
    return false;
  }
  if (dark && view.dark !== true) {
    return false;
  }
  if (resp === undefined) {
    return true;
  }
  if (resp.startsWith('max-')) {
    const key = resp.slice(4);
    const threshold = getThreshold(key, ctx);
    return view.width < threshold;
  }
  const threshold = getThreshold(resp, ctx);
  return view.width >= threshold;
}

function getRank(
  token: ClassToken,
  ctx: ClassContext,
): { readonly stateRank: number; readonly respRank: number } {
  const { resp, state, dark } = getVariantsInfo(token, ctx);
  const stateRank = (state !== undefined ? 2 : 0) + (dark ? 1 : 0);
  if (resp === undefined) {
    return { stateRank, respRank: 0 };
  }
  if (resp.startsWith('max-')) {
    const key = resp.slice(4);
    const threshold = getThreshold(key, ctx);
    return { stateRank, respRank: 100000 - threshold };
  }
  const threshold = getThreshold(resp, ctx);
  return { stateRank, respRank: threshold };
}

function getFamilySpec(targetProp: PropertyId, candidateProp: PropertyId): number {
  if (candidateProp === targetProp) return 3;
  const fam = SPACING_FAMILIES[targetProp];
  if (fam?.axis === candidateProp) return 2;
  if (fam?.all === candidateProp) return 1;
  return 0;
}

function extractScope(token: ClassToken, ctx?: ClassContext): Scope {
  const { resp, state, dark } = getVariantsInfo(token, ctx);
  let breakpoint: Breakpoint = 'base';
  if (resp !== undefined) {
    const raw = resp.startsWith('max-') ? resp.slice(4) : resp;
    breakpoint = raw;
  }
  return dark ? { breakpoint, state, dark: true } : { breakpoint, state };
}

function selectBestCandidate(
  candidates: readonly ClassToken[],
  property: PropertyId,
  ctx: ClassContext,
): { readonly best?: ClassToken | undefined; readonly conflict: boolean } {
  let best = candidates[0];
  let conflict = false;

  for (let i = 1; i < candidates.length; i += 1) {
    const curr = candidates[i];
    if (best?.property === undefined || curr?.property === undefined) continue;

    const rankBest = getRank(best, ctx);
    const rankCurr = getRank(curr, ctx);

    if (rankCurr.stateRank > rankBest.stateRank) {
      best = curr;
      conflict = false;
    } else if (rankCurr.stateRank === rankBest.stateRank) {
      if (rankCurr.respRank > rankBest.respRank) {
        best = curr;
        conflict = false;
      } else if (rankCurr.respRank === rankBest.respRank) {
        const specBest = getFamilySpec(property, best.property);
        const specCurr = getFamilySpec(property, curr.property);
        if (specCurr > specBest) {
          best = curr;
          conflict = false;
        } else if (specCurr === specBest) {
          best = curr;
          conflict = true;
        }
      }
    }
  }

  return { best, conflict };
}

export function readValue(
  tokens: readonly ClassToken[],
  property: PropertyId,
  view: ReadView,
  ctx: ClassContext,
): {
  readonly value?: ClassValue | undefined;
  readonly from?: Scope | undefined;
  readonly token?: ClassToken | undefined;
  readonly conflict: boolean;
} {
  const fam = SPACING_FAMILIES[property];
  const allowed = new Set<string>([property]);
  if (fam?.axis !== undefined) allowed.add(fam.axis);
  if (fam?.all !== undefined) allowed.add(fam.all);

  const candidates = tokens.filter(
    (t) => t.property !== undefined && allowed.has(t.property) && appliesToView(t, view, ctx),
  );

  if (candidates.length === 0) {
    return { value: undefined, from: undefined, token: undefined, conflict: false };
  }

  const { best, conflict } = selectBestCandidate(candidates, property, ctx);
  if (best === undefined) {
    return { value: undefined, from: undefined, token: undefined, conflict: false };
  }

  return {
    value: best.value,
    from: extractScope(best, ctx),
    token: best,
    conflict,
  };
}
