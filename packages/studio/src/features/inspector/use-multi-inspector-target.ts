// Hook managing Inspector multi-target selection and batch source loading (M-IN, R-CB-15).
import { type ElementRef, parseLocString } from '@reactcraft/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createEventsClient } from '../../api/events-client.ts';
import { fetchElementSource } from '../../api/source-client.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useScopeCalculation } from './inspector-scope.ts';
import type { MultiTarget, MultiTargetItem } from './types.ts';
import type { UseInspectorTargetOptions } from './use-inspector-target.ts';

export function deriveMultiLock(
  items: readonly MultiTargetItem[],
): { tag: string; loc: string } | undefined {
  for (const item of items) {
    const src = item.source;
    if (!src) continue;
    if (
      src.readonly !== undefined ||
      src.className.kind === 'expression' ||
      src.className.kind === 'duplicate'
    ) {
      return { tag: src.tag, loc: src.loc };
    }
  }
  return undefined;
}

type MultiLoaderState = {
  readonly refsKey?: string | undefined;
  readonly refreshKey: number;
  readonly items: readonly MultiTargetItem[];
};

async function fetchMultiSources(refs: readonly ElementRef[]): Promise<MultiTargetItem[]> {
  return Promise.all(
    refs.map(async (ref) => {
      const parsed = parseLocString(ref.loc);
      if (!parsed) return { ref };
      try {
        const src = await fetchElementSource({
          file: parsed.file,
          line: parsed.line,
          column: parsed.column,
        });
        return { ref, source: src };
      } catch {
        return { ref };
      }
    }),
  );
}

function useMultiSourceLoader(
  enabled: boolean,
  selectedRefs: readonly ElementRef[],
  refreshKey: number,
): { items: readonly MultiTargetItem[]; loading: boolean } {
  const [data, setData] = useState<MultiLoaderState>({
    refreshKey: 0,
    items: [],
  });

  const currentRefsKey = useMemo(
    () => (enabled ? selectedRefs.map((r) => r.loc).join(',') : undefined),
    [enabled, selectedRefs],
  );

  useEffect(() => {
    if (!enabled || currentRefsKey === undefined) return undefined;
    const activeRefs = selectedRefs;
    const activeKey = currentRefsKey;
    let cancelled = false;

    async function load(): Promise<void> {
      const results = await fetchMultiSources(activeRefs);
      if (!cancelled) {
        setData({ refsKey: activeKey, refreshKey, items: results });
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, selectedRefs, currentRefsKey, refreshKey]);

  if (!enabled || currentRefsKey === undefined) {
    return { items: [], loading: false };
  }

  // Sources of another selection must never be edited; while the same selection reloads after a
  // save, its last sources stay so the fields keep their focus.
  const sameSelection = data.refsKey === currentRefsKey;
  return {
    items: sameSelection ? data.items : [],
    loading: !sameSelection || data.refreshKey !== refreshKey,
  };
}

function useMultiServerRefresh(enabled: boolean, onRefresh: () => void): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return undefined;
    const client = createEventsClient({
      onEvent: (event) => {
        if (event.type === 'history.changed' || event.type === 'project.filesChanged') {
          if (timerRef.current !== undefined) return;
          timerRef.current = setTimeout(() => {
            timerRef.current = undefined;
            onRefresh();
          }, 100);
        }
      },
    });

    return () => {
      if (timerRef.current !== undefined) clearTimeout(timerRef.current);
      client.close();
    };
  }, [enabled, onRefresh]);
}

export function useMultiInspectorTarget(options: UseInspectorTargetOptions = {}): MultiTarget {
  const { frame, primaryFrame, responsiveMode = 'desktop-first', enabled = true } = options;
  const selectedRefs = useSelectionStore((s) => s.selectedRefs);
  const isMulti = enabled && selectedRefs.length > 1;
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const { items, loading } = useMultiSourceLoader(isMulti, selectedRefs, refreshKey);
  useMultiServerRefresh(isMulti, refresh);

  const { currentScope, writePrefix } = useScopeCalculation(
    frame,
    primaryFrame,
    responsiveMode,
    undefined,
  );

  const lock = useMemo(() => deriveMultiLock(items), [items]);

  return {
    kind: 'multi',
    items,
    loading,
    lock,
    currentScope,
    writePrefix,
    refresh,
  };
}
