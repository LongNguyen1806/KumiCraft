// Which screens an Inspector edit reaches (spec-log #141). The Canvas frames are views of one page:
// an edit changes every frame, unless the user picks "only this screen" for the selected element.
// When a property already differs by screen, the edit waits for the user to say which they meant.
import {
  type ClassContext,
  type ClassValue,
  differsByScreen,
  type Frame,
  parseClasses,
  primarySystem,
  projectBreakpoints,
  type PropertyId,
  readScreenValues,
  type Scope,
  writeAllScreens,
  writeOneScreen,
  writeValue,
} from '@kumicraft/shared';
import { useMemo } from 'react';
import { create } from 'zustand';

import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useProjectInfo, useProjectStore } from '../project/project-store.ts';
import { useThemeStore } from './use-project-theme.ts';

export type ScreenEntry = {
  readonly property: PropertyId;
  readonly value: ClassValue | undefined;
  readonly scope?: Scope | undefined;
};

/** The edit waiting for the user's answer, and how to finish it either way. */
export type PendingScreenEdit = {
  readonly properties: readonly PropertyId[];
  readonly apply: (onlyThisScreen: boolean) => void;
};

/**
 * "Edit for this screen only" (spec-log #144): started on a narrower frame for one element. While
 * it runs every edit of that element on that frame — Inspector or Canvas — reaches only that
 * screen. It ends with Done, Cancel (undoes its edits), another element or another frame.
 */
export type ScreenSession = {
  readonly loc: string;
  readonly frameId: string;
  /** The history's undo count when it started: Cancel undoes back to it. */
  readonly undoAtStart: number;
};

type ScreenEditState = {
  readonly session?: ScreenSession | undefined;
  readonly pending?: PendingScreenEdit | undefined;
  /** Set by the selected element's live edit: drops the active screen's own value. */
  readonly drop?: ((property: PropertyId) => void) | undefined;
  readonly setSession: (session: ScreenSession | undefined) => void;
  readonly setPending: (pending: PendingScreenEdit | undefined) => void;
  readonly setDrop: (drop: ((property: PropertyId) => void) | undefined) => void;
};

export const useScreenEditStore = create<ScreenEditState>((set) => ({
  setSession: (session) => {
    set({ session });
  },
  setPending: (pending) => {
    set({ pending });
  },
  setDrop: (drop) => {
    set({ drop });
  },
}));

export type Screens = {
  readonly frames: readonly Frame[];
  readonly widths: readonly number[];
  readonly activeIndex: number;
  readonly active?: Frame | undefined;
};

/** The Canvas frames and the one being edited. */
export function useScreens(): Screens {
  const storeFrames = useCanvasViewStore((s) => s.frames);
  const activeFrameId = useCanvasViewStore((s) => s.activeFrameId);
  const projectFrames = useProjectInfo()?.frames;
  return useMemo(() => {
    const frames = storeFrames.length > 0 ? storeFrames : (projectFrames ?? []);
    const found = frames.findIndex((f) => f.id === activeFrameId);
    const activeIndex = found >= 0 ? found : 0;
    return {
      frames,
      widths: frames.map((f) => f.width),
      activeIndex,
      active: frames[activeIndex],
    };
  }, [storeFrames, projectFrames, activeFrameId]);
}

export type ScreenWrite =
  | { readonly kind: 'write'; readonly next: string }
  | { readonly kind: 'ask' }
  | { readonly kind: 'fail' };

/** How the edit is sent: `auto` asks when a property differs by screen; the others are answers. */
export type ScreenMode = 'auto' | 'all' | 'only';

const isStateScope = (scope: Scope | undefined): boolean =>
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
  screens: Pick<Screens, 'widths' | 'activeIndex'>,
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
  screens: Pick<Screens, 'widths' | 'activeIndex'>,
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
  screens: Pick<Screens, 'widths' | 'activeIndex'>,
  ctx: ClassContext,
): boolean {
  return (
    screens.widths.length > 1 && sharedValueOfOthers(base, property, screens, ctx) !== undefined
  );
}

/**
 * Whether a field shows the "own value on this screen" mark: never for mixed fields, nor for
 * hover/focus/dark edits, which always reach every screen.
 */
export function useOwnScreen(
  tokens: readonly { readonly raw: string }[],
  property: PropertyId,
  scope: Scope,
  ctx: ClassContext,
  mixed: boolean,
): boolean {
  const screens = useScreens();
  if (mixed || isStateScope(scope)) return false;
  return hasOwnScreenValue(tokens.map((t) => t.raw).join(' '), property, screens, ctx);
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
  screens: Pick<Screens, 'widths' | 'activeIndex'>,
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

/** The project's class reading context, outside React (same as the Inspector's). */
export function currentClassContext(): ClassContext {
  const theme = useThemeStore.getState().theme;
  const project = useProjectStore.getState().project;
  return {
    theme,
    mode: project?.responsiveMode ?? 'desktop-first',
    breakpoints: Object.fromEntries(projectBreakpoints(theme).map((b) => [b.key, b.min])),
    major: primarySystem(project?.support.styling) === 'tailwind3' ? 3 : 4,
  };
}

/** The Canvas frames and the active one, outside React. */
export function currentScreens(): Pick<Screens, 'widths' | 'activeIndex'> {
  const { frames: storeFrames, activeFrameId } = useCanvasViewStore.getState();
  const frames =
    storeFrames.length > 0 ? storeFrames : (useProjectStore.getState().project?.frames ?? []);
  const found = frames.findIndex((f) => f.id === activeFrameId);
  return { widths: frames.map((f) => f.width), activeIndex: found >= 0 ? found : 0 };
}

/** `scopeClassChange` with the live project, frames and "only this screen" of element `loc`. */
export function scopeCanvasChange(loc: string, before: string, after: string): string | undefined {
  if (before === after) return after;
  return scopeClassChange(before, after, currentClassContext(), currentScreens(), inSession(loc));
}

/** True while an "edit for this screen only" runs for element `loc` on the active frame. */
export function inSession(loc: string): boolean {
  const session = useScreenEditStore.getState().session;
  return (
    session !== undefined &&
    session.loc === loc &&
    session.frameId === useCanvasViewStore.getState().activeFrameId
  );
}

/** The same, as a hook for the Inspector. */
export function useInSession(loc: string): boolean {
  const session = useScreenEditStore((s) => s.session);
  const activeFrameId = useCanvasViewStore((s) => s.activeFrameId);
  return session !== undefined && session.loc === loc && session.frameId === activeFrameId;
}

/** The widest frame is where the page is designed: it has no "only this screen" edit. */
export function isDesignFrame(screens: Pick<Screens, 'widths' | 'activeIndex'>): boolean {
  const mine = screens.widths[screens.activeIndex] ?? 0;
  return screens.widths.every((w) => w <= mine);
}
