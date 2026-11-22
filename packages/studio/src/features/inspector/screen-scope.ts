// Which screens an Inspector edit reaches (spec-log #141). The Canvas frames are views of one page:
// an edit changes every frame, unless the user picks "only this screen" for the selected element.
// When a property already differs by screen, the edit waits for the user to say which they meant.
import type { CanvasScope, Frame } from '@kumicraft/shared';
import {
  type ClassContext,
  classContextOf,
  hasOwnScreenValue,
  isStateScope,
  type PropertyId,
  type Scope,
  type ScreenWidths,
} from '@kumicraft/style-tailwind';
import { useMemo } from 'react';
import { create } from 'zustand';

import { useCanvasViewStore } from '../../core/canvas-view-store.ts';
import { useProjectInfo, useProjectStore } from '../../core/project-store.ts';
import { useThemeStore } from './use-project-theme.ts';

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

/** The project's class reading context, outside React (same as the Inspector's). */
export function currentClassContext(): ClassContext {
  const theme = useThemeStore.getState().theme;
  const project = useProjectStore.getState().project;
  return classContextOf(
    theme,
    project?.responsiveMode ?? 'desktop-first',
    project?.support.styling,
  );
}

/** The Canvas frames and the active one, outside React. */
export function currentScreens(): ScreenWidths {
  const { frames: storeFrames, activeFrameId } = useCanvasViewStore.getState();
  const frames =
    storeFrames.length > 0 ? storeFrames : (useProjectStore.getState().project?.frames ?? []);
  const found = frames.findIndex((f) => f.id === activeFrameId);
  return { widths: frames.map((f) => f.width), activeIndex: found >= 0 ? found : 0 };
}

/** The screens a Canvas change of element `loc` reaches (spec-log #144), sent with the change. */
export function canvasScope(loc: string): CanvasScope {
  const screens = currentScreens();
  return {
    screens: { widths: [...screens.widths], activeIndex: screens.activeIndex },
    onlyThisScreen: inSession(loc),
  };
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
