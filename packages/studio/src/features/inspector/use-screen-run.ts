// Inspector edits reach every screen, or only the active one (spec-log #141): the live-edit side of
// the screen-edit store (question bar, "only this screen", the field icons that drop a value).
import type { ClassContext, PropertyId } from '@kumicraft/shared';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type ScreenEntry,
  type ScreenMode,
  type Screens,
  sharedValueOfOthers,
  useScreenEditStore,
  useScreens,
  writeEntries,
} from './screen-scope.ts';
import type { InspectorTarget } from './types.ts';

/**
 * "Only this screen" holds for the element it was turned on for: selecting another one turns it
 * off, and a question left open about the previous element is dropped.
 */
export function useScreenSelectionReset(loc: string): void {
  useEffect(() => {
    const store = useScreenEditStore.getState();
    if (store.onlyKey !== undefined && store.onlyKey !== loc) store.setOnly(undefined);
    store.setPending(undefined);
  }, [loc]);
}

type ScreenRun = (entries: readonly ScreenEntry[], mode: ScreenMode) => void;

/** Lets the field icons drop the active screen's own value of a property. */
function useScreenDrop(
  run: React.RefObject<ScreenRun | undefined>,
  classRef: React.RefObject<string>,
  screens: Screens,
  ctx: ClassContext,
): void {
  useEffect(() => {
    useScreenEditStore.getState().setDrop((property) => {
      const shared = sharedValueOfOthers(classRef.current, property, screens, ctx);
      if (shared !== undefined) run.current?.([{ property, value: shared.value }], 'only');
    });
    return () => {
      useScreenEditStore.getState().setDrop(undefined);
    };
  }, [run, classRef, screens, ctx]);
}

type ScreenRunInput = {
  readonly loc: string;
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
  readonly ctx: ClassContext;
  readonly optimisticClass: string;
  readonly send: (change: (base: string) => string, property?: PropertyId) => void;
  readonly setError: (msg: string | undefined) => void;
};

/**
 * Sends Inspector edits to every screen, or only the active one (spec-log #141). When a property
 * already differs by screen the edit waits for the user's answer in the Inspector's question bar.
 */
export function useScreenRun(input: ScreenRunInput): {
  readonly run: ScreenRun;
  readonly only: boolean;
} {
  const { loc, target, ctx, optimisticClass, send, setError } = input;
  const { t } = useTranslation();
  const screens = useScreens();
  const only = useScreenEditStore((s) => s.onlyKey === loc);
  const runRef = useRef<ScreenRun | undefined>(undefined);
  const classRef = useRef(optimisticClass);
  const run: ScreenRun = (entries, mode) => {
    const scope = target.currentScope;
    const tried = writeEntries(optimisticClass, entries, scope, ctx, screens, mode);
    if (tried.kind === 'ask') {
      useScreenEditStore.getState().setPending({
        properties: entries.map((e) => e.property),
        apply: (onlyThisScreen) => {
          useScreenEditStore.getState().setPending(undefined);
          runRef.current?.(entries, onlyThisScreen ? 'only' : 'all');
        },
      });
      return;
    }
    if (tried.kind === 'fail') {
      setError(t('inspector.screen.cannotSplit'));
      return;
    }
    const final: ScreenMode = mode === 'auto' ? 'all' : mode;
    send(
      (base) => {
        const out = writeEntries(base, entries, scope, ctx, screens, final);
        return out.kind === 'write' ? out.next : base;
      },
      entries.length === 1 ? entries[0]?.property : undefined,
    );
  };
  useEffect(() => {
    runRef.current = run;
    classRef.current = optimisticClass;
  });
  useScreenDrop(runRef, classRef, screens, ctx);
  return { run, only };
}
