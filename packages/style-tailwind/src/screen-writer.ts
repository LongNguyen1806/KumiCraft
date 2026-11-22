// Per-screen writes (spec-log #141): the Canvas frames are views of one page. An edit sets the value
// a property should have on each frame; the property's screen classes are then rewritten the way a
// developer writes them by hand (`grid-cols-1 md:grid-cols-3`) and read back to prove every frame
// shows what was asked. A result that does not read back exactly is never returned.
import { parseBreakpointValue } from '@kumicraft/shared';

import { parseClasses } from './parser.ts';
import { ALL_TO_MEMBERS, formatClassValue } from './properties.ts';
import { readValue } from './reader.ts';
import type { ClassContext, ClassToken, ClassValue, PropertyId } from './types.ts';
import { writeValue } from './writer.ts';

/** The value of one property on each frame, in the order of `widths`. */
export type ScreenValues = readonly (ClassValue | undefined)[];

/**
 * Two values are the same when they write the same class: a field may send `{scale: 'col'}` where
 * the reader gives `{keyword: 'col'}` for `flex-col`, and both mean one thing.
 */
function sameValue(
  property: PropertyId,
  a: ClassValue | undefined,
  b: ClassValue | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  return formatClassValue(property, a) === formatClassValue(property, b);
}

/** Every breakpoint the project knows, narrowest first. */
function projectBreakpointList(
  ctx: ClassContext,
): { readonly key: string; readonly min: number }[] {
  const byKey = new Map<string, number>(Object.entries(ctx.breakpoints));
  for (const bp of ctx.theme.breakpoints) {
    const key = bp.name.replace(/^--breakpoint-/, '');
    const min = parseBreakpointValue(bp.value);
    if (min !== undefined && /^[a-z0-9]{1,10}$/.test(key)) byKey.set(key, min);
  }
  return [...byKey.entries()].map(([key, min]) => ({ key, min })).sort((a, b) => a.min - b.min);
}

/** Where the usual device sizes end: phones below 768 px, tablets below 1024 px. */
const DEVICE_LIMITS = [768, 1024];

/**
 * The breakpoint that separates a narrower frame from the next wider one: it must start above the
 * narrow width and at or below the wide one, so `md:` holds on the wide frame only and `max-md:` on
 * the narrow one. Among those, the one where the narrow frame's device size ends is preferred (a
 * phone frame ends at `md`, a tablet at `lg`), as developers write by hand; else the smallest.
 */
function boundaryBetween(narrow: number, wide: number, ctx: ClassContext): string | undefined {
  const inside = projectBreakpointList(ctx).filter((bp) => bp.min > narrow && bp.min <= wide);
  const deviceEnd = DEVICE_LIMITS.find((limit) => limit > narrow);
  return (inside.find((bp) => bp.min === deviceEnd) ?? inside[0])?.key;
}

/** What the property shows on each frame now (no hover/focus/dark state). */
export function readScreenValues(
  input: string,
  property: PropertyId,
  widths: readonly number[],
  ctx: ClassContext,
): (ClassValue | undefined)[] {
  const tokens = parseClasses(input, ctx);
  return widths.map((width) => readValue(tokens, property, { width }, ctx).value);
}

/** True when the frames do not all show the same value for the property. */
export function differsByScreen(
  input: string,
  property: PropertyId,
  widths: readonly number[],
  ctx: ClassContext,
): boolean {
  const values = readScreenValues(input, property, widths, ctx);
  return values.some((value) => !sameValue(property, value, values[0]));
}

function isScreenOnlyToken(token: ClassToken, ctx: ClassContext): boolean {
  const keys = new Set(projectBreakpointList(ctx).map((bp) => bp.key));
  return token.variants.every((v) => keys.has(v.startsWith('max-') ? v.slice(4) : v));
}

/**
 * Drops the property's screen classes (`md:`, `max-md:`; never hover, focus or dark ones). The plain
 * class stays, so writing over it keeps what it carries, such as a glass color's opacity.
 */
function dropScreenClasses(input: string, property: PropertyId, ctx: ClassContext): string {
  const props = new Set<string>([property, ...(ALL_TO_MEMBERS[property] ?? [])]);
  const doomed = parseClasses(input, ctx)
    .filter(
      (t) =>
        t.property !== undefined &&
        props.has(t.property) &&
        t.variants.length > 0 &&
        isScreenOnlyToken(t, ctx),
    )
    .sort((a, b) => b.start - a.start);
  let out = input;
  for (const token of doomed) out = out.slice(0, token.start) + out.slice(token.end);
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Writes the property so frame `i` (widths ascending or not) shows `values[i]`. Mobile-first
 * projects start from the narrowest frame and add `md:`-style classes going wider; desktop-first
 * ones start from the widest and add `max-md:` going narrower. `undefined` when two frames that must
 * differ have no breakpoint between them, or the result would not read back as asked.
 */
export function writeScreenValues(
  input: string,
  property: PropertyId,
  widths: readonly number[],
  values: ScreenValues,
  ctx: ClassContext,
): string | undefined {
  // A screen whose value is unset next to one that has a value can only be written from the other
  // end (Mobile alone `flex-col` → `max-md:flex-col`), as a developer would: try the project's
  // own direction first, then the other one; both are read back on every frame.
  const flipped: ClassContext = {
    ...ctx,
    mode: ctx.mode === 'desktop-first' ? 'mobile-first' : 'desktop-first',
  };
  return (
    writeScreenValuesOneWay(input, property, widths, values, ctx) ??
    writeScreenValuesOneWay(input, property, widths, values, flipped)
  );
}

function writeScreenValuesOneWay(
  input: string,
  property: PropertyId,
  widths: readonly number[],
  values: ScreenValues,
  ctx: ClassContext,
): string | undefined {
  const frames = widths
    .map((width, i) => ({ width, value: values[i] }))
    .sort((a, b) => (ctx.mode === 'desktop-first' ? b.width - a.width : a.width - b.width));
  if (frames.length === 0) return input;

  let out = dropScreenClasses(input, property, ctx);
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    if (frame === undefined) continue;
    const shown = readValue(parseClasses(out, ctx), property, { width: frame.width }, ctx).value;
    if (sameValue(property, shown, frame.value)) continue;
    // An unset value cannot be written: the frame keeps what the others show.
    if (frame.value === undefined) return undefined;
    const prev = frames[i - 1];
    const boundary =
      prev === undefined
        ? 'base'
        : boundaryBetween(
            Math.min(prev.width, frame.width),
            Math.max(prev.width, frame.width),
            ctx,
          );
    if (boundary === undefined) return undefined;
    out = writeValue(out, property, { breakpoint: boundary }, frame.value, ctx);
  }

  const proof = readScreenValues(out, property, widths, ctx);
  return proof.every((value, i) => sameValue(property, value, values[i])) ? out : undefined;
}

/** Sets one frame's value and keeps what the other frames show. */
export function writeOneScreen(
  input: string,
  property: PropertyId,
  widths: readonly number[],
  index: number,
  value: ClassValue | undefined,
  ctx: ClassContext,
): string | undefined {
  const values = readScreenValues(input, property, widths, ctx);
  values[index] = value;
  return writeScreenValues(input, property, widths, values, ctx);
}

/** Every frame shows `value`: the property's screen classes collapse into one plain class. */
export function writeAllScreens(
  input: string,
  property: PropertyId,
  value: ClassValue | undefined,
  ctx: ClassContext,
): string {
  return writeValue(
    dropScreenClasses(input, property, ctx),
    property,
    { breakpoint: 'base' },
    value,
    ctx,
  );
}

/**
 * Drops the frame's own value: it shows again what its neighbour toward the base frame shows (the
 * next narrower frame in a mobile-first project, the next wider one in a desktop-first one).
 */
export function dropOneScreen(
  input: string,
  property: PropertyId,
  widths: readonly number[],
  index: number,
  ctx: ClassContext,
): string | undefined {
  const values = readScreenValues(input, property, widths, ctx);
  const me = widths[index];
  if (me === undefined) return undefined;
  const towardBase = widths
    .map((width, i) => ({ width, i }))
    .filter(({ width }) => (ctx.mode === 'desktop-first' ? width > me : width < me))
    .sort((a, b) => (ctx.mode === 'desktop-first' ? a.width - b.width : b.width - a.width))[0];
  if (towardBase === undefined) return input;
  values[index] = values[towardBase.i];
  return writeScreenValues(input, property, widths, values, ctx);
}
