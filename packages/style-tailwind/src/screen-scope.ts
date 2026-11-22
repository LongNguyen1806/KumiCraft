// Which screens a class edit reaches (spec-log #141, #144): the Canvas frames are views of one page;
// an edit changes every frame, unless it is made for the active screen only. Pure functions, run by
// the Studio (preview, "ask which screens") and by the server (the class an edit writes).
import { parseClasses } from './parser.ts';
import {
  differsByScreen,
  readScreenValues,
  writeAllScreens,
  writeOneScreen,
} from './screen-writer.ts';
import type { ClassContext, ClassValue, PropertyId, Scope } from './types.ts';
import { writeValue } from './writer.ts';

/** The widths of the Canvas frames and the index of the one being edited. */
export type ScreenWidths = {
  readonly widths: readonly number[];
  readonly activeIndex: number;
};

export type ScreenEntry = {
  readonly property: PropertyId;
  readonly value?: ClassValue | undefined;
  readonly scope?: Scope | undefined;
};

/** The edit waiting for the user's answer, and how to finish it either way. */

export type ScreenWrite =
  | { readonly kind: 'write'; readonly next: string }
  | { readonly kind: 'ask' }
  | { readonly kind: 'fail' };

/** How the edit is sent: `auto` asks when a property differs by screen; the others are answers. */
export type ScreenMode = 'auto' | 'all' | 'only';

/** Hover, focus and dark edits: they reach every screen. */
export const isStateScope = (scope: Scope | undefined): boolean =>
  scope !== undefined && (scope.state !== undefined || scope.dark === true);

/**
 * The class after the edit. Hover, focus and dark edits reach every screen as before; the others go
 * through the per-screen writer, which reads its result back on every frame.
 */
export function writeEntries(
  base: string,
  entries: readonly ScreenEntry[],
  scope: Scope,
  ctx: ClassContext,
  screens: ScreenWidths,
  mode: ScreenMode,
): ScreenWrite {
  const plain = entries.filter((e) => !isStateScope(e.scope ?? scope));
  if (
    mode === 'auto' &&
    plain.some((e) => differsByScreen(base, e.property, screens.widths, ctx))
  ) {
    return { kind: 'ask' };
  }
  let next = base;
  for (const entry of entries) {
    const entryScope = entry.scope ?? scope;
    if (isStateScope(entryScope)) {
      next = writeValue(
        next,
        entry.property,
        { ...entryScope, breakpoint: 'base' },
        entry.value,
        ctx,
      );
    } else if (mode === 'only') {
      const one = writeOneScreen(
        next,
        entry.property,
        screens.widths,
        screens.activeIndex,
        entry.value,
        ctx,
      );
      if (one === undefined) return { kind: 'fail' };
      next = one;
    } else {
      next = writeAllScreens(next, entry.property, entry.value, ctx);
    }
  }
  return { kind: 'write', next };
}

const key = (value: ClassValue | undefined): string =>
  value === undefined ? '' : JSON.stringify(value);

/**
 * What the active screen shows when it drops its own value: the value most other screens share
 * (the widest screen breaks a tie, as pages are designed from Desktop down). `undefined` result:
 * the screen has no value of its own.
 */
export function sharedValueOfOthers(
  base: string,
  property: PropertyId,
  screens: ScreenWidths,
  ctx: ClassContext,
): { readonly value: ClassValue | undefined } | undefined {
  const values = readScreenValues(base, property, screens.widths, ctx);
  const mine = key(values[screens.activeIndex]);
  const others = values
    .map((value, i) => ({ value, width: screens.widths[i] ?? 0, i }))
    .filter(({ i }) => i !== screens.activeIndex);
  const counts = new Map<string, number>();
  for (const { value } of others) counts.set(key(value), (counts.get(key(value)) ?? 0) + 1);
  const best = [...others].sort(
    (a, b) =>
      (counts.get(key(b.value)) ?? 0) - (counts.get(key(a.value)) ?? 0) || b.width - a.width,
  )[0];
  // Showing what the others share already: nothing of its own to drop.
  return best === undefined || key(best.value) === mine ? undefined : { value: best.value };
}

/** True when the active screen shows a value the other screens do not all share. */
export function hasOwnScreenValue(
  base: string,
  property: PropertyId,
  screens: ScreenWidths,
  ctx: ClassContext,
): boolean {
  return (
    screens.widths.length > 1 && sharedValueOfOthers(base, property, screens, ctx) !== undefined
  );
}

/** The base value (no prefix, no state) each property has in a class string. */
function baseValues(input: string, ctx: ClassContext): Map<PropertyId, string> {
  const out = new Map<PropertyId, string>();
  for (const token of parseClasses(input, ctx)) {
    if (token.property !== undefined && token.variants.length === 0) {
      out.set(token.property, key(token.value));
    }
  }
  return out;
}

function baseValueOf(
  input: string,
  property: PropertyId,
  ctx: ClassContext,
): ClassValue | undefined {
  return parseClasses(input, ctx).find((t) => t.property === property && t.variants.length === 0)
    ?.value;
}

const unmapped = (input: string, ctx: ClassContext): string =>
  parseClasses(input, ctx)
    .filter((t) => t.property === undefined)
    .map((t) => t.raw)
    .sort()
    .join(' ');

/**
 * A class change made on the Canvas (drag, resize, nudge, align, X/Y/W/H), turned into the same
 * screen scope as an Inspector edit (spec-log #144): only the active screen when "only this screen"
 * is on; otherwise every screen, except a property the active screen already has its own value
 * for, which is changed there so the drag shows. `undefined`: it cannot be split for this screen.
 */
export function scopeClassChange(
  before: string,
  after: string,
  ctx: ClassContext,
  screens: ScreenWidths,
  onlyThisScreen: boolean,
): string | undefined {
  const was = baseValues(before, ctx);
  const now = baseValues(after, ctx);
  const changed = [...new Set([...was.keys(), ...now.keys()])].filter(
    (p) => was.get(p) !== now.get(p),
  );
  const ownHere = (cls: string, p: PropertyId) => hasOwnScreenValue(cls, p, screens, ctx);
  if (changed.length === 0 || (!onlyThisScreen && !changed.some((p) => ownHere(before, p)))) {
    return after;
  }
  // Rebuilt from `before`: a change outside known properties could not be kept, so refuse it.
  if (unmapped(before, ctx) !== unmapped(after, ctx)) return undefined;
  let out = before;
  for (const property of changed) {
    const value = baseValueOf(after, property, ctx);
    if (onlyThisScreen || ownHere(out, property)) {
      const one = writeOneScreen(out, property, screens.widths, screens.activeIndex, value, ctx);
      if (one === undefined) return undefined;
      out = one;
    } else {
      out = writeValue(out, property, { breakpoint: 'base' }, value, ctx);
    }
  }
  return out;
}

/** The widest frame is where the page is designed: it has no "only this screen" edit. */
export function isDesignFrame(screens: ScreenWidths): boolean {
  const mine = screens.widths[screens.activeIndex] ?? 0;
  return screens.widths.every((w) => w <= mine);
}
