// Class edits sent as intents (03 section 3.3, ADR-A4): the one place that turns the steps of a
// `setClasses` edit into a class string. The Studio runs it to show the result at once; the server
// runs it to decide what is written.
import {
  type ClassStep,
  primarySystem,
  projectBreakpoints,
  type ResponsiveMode,
  type StylingReport,
  type ThemeInfo,
} from '@kumicraft/shared';

import { applyPlacement, applySize, clearSize } from './free-position.ts';
import { scopeClassChange, type ScreenWidths, writeEntries } from './screen-scope.ts';
import type { ClassContext } from './types.ts';
import { writeValue } from './writer.ts';

export type ClassStepsResult =
  | { readonly ok: true; readonly value: string }
  /** A change cannot be split for the active screen only (E023 `screenSplit`). */
  | { readonly ok: false; readonly reason: 'screenSplit' };

/** The class reading context of a project: its theme, responsive mode and Tailwind major. */
export function classContextOf(
  theme: ThemeInfo,
  mode: ResponsiveMode,
  styling: StylingReport | undefined,
): ClassContext {
  return {
    theme,
    mode,
    breakpoints: Object.fromEntries(projectBreakpoints(theme).map((b) => [b.key, b.min])),
    major: primarySystem(styling) === 'tailwind3' ? 3 : 4,
  };
}

/** Unprefixed position classes that already make a frame the parent of absolute children. */
const POSITIONED: ReadonlySet<string> = new Set(['relative', 'absolute', 'fixed', 'sticky']);

const words = (classString: string): string[] => classString.split(/\s+/).filter(Boolean);

/**
 * A free frame turned on: children are placed from its corner, so it must be positioned; one that
 * already is (a free child is `absolute`) keeps its own (spec-log #127). A frame sized by its
 * content keeps the size it shows, or it shrinks to nothing (spec-log #129).
 */
function frameOn(
  classString: string,
  size: { readonly width?: number | undefined; readonly height?: number | undefined },
): string {
  const out = words(classString);
  if (!out.some((c) => POSITIONED.has(c))) out.push('relative');
  if (size.width !== undefined) out.push(`w-[${String(Math.round(size.width))}px]`);
  if (size.height !== undefined) out.push(`h-[${String(Math.round(size.height))}px]`);
  return out.join(' ');
}

type Canvas = Extract<ClassStep, { kind: 'place' }>['canvas'];

/** A Canvas change in the same screen scope as an Inspector edit (spec-log #144). */
function scoped(
  before: string,
  after: string,
  canvas: Canvas,
  ctx: ClassContext,
): ClassStepsResult {
  if (canvas === undefined || before === after) return { ok: true, value: after };
  const out = scopeClassChange(before, after, ctx, canvas.screens, canvas.onlyThisScreen);
  return out === undefined ? { ok: false, reason: 'screenSplit' } : { ok: true, value: out };
}

function setStep(
  base: string,
  step: Extract<ClassStep, { kind: 'set' }>,
  ctx: ClassContext,
): ClassStepsResult {
  const screens: ScreenWidths = step.screens;
  const out = writeEntries(base, step.entries, step.scope, ctx, screens, step.mode);
  return out.kind === 'write'
    ? { ok: true, value: out.next }
    : { ok: false, reason: 'screenSplit' };
}

function applyStep(base: string, step: ClassStep, ctx: ClassContext): ClassStepsResult {
  const major = ctx.major ?? 4;
  switch (step.kind) {
    case 'set':
      return setStep(base, step, ctx);
    case 'value':
      return { ok: true, value: writeValue(base, step.property, step.scope, step.value, ctx) };
    case 'place':
      return scoped(base, applyPlacement(base, step.placement, major), step.canvas, ctx);
    case 'size':
      return scoped(base, applySize(base, step, major), step.canvas, ctx);
    case 'clearSize':
      return scoped(base, clearSize(base), step.canvas, ctx);
    case 'frameOn':
      return { ok: true, value: frameOn(base, step) };
    case 'frameOff':
      return {
        ok: true,
        value: words(base)
          .filter((c) => c !== 'relative')
          .join(' '),
      };
    case 'addClass':
      return {
        ok: true,
        value: words(base).includes(step.name) ? base : [step.name, ...words(base)].join(' '),
      };
    case 'raw':
      return { ok: true, value: step.className };
  }
}

/** Applies the steps in order. Stops at the first step that cannot be made. */
export function applyClassSteps(
  base: string,
  steps: readonly ClassStep[],
  ctx: ClassContext,
): ClassStepsResult {
  let value = base;
  for (const step of steps) {
    const out = applyStep(value, step, ctx);
    if (!out.ok) return out;
    value = out.value;
  }
  return { ok: true, value };
}
