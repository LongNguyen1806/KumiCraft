// Hook managing Inspector target selection, source fetching, and scope (SPEC-04 M-IN, R-IN-10..16, R-IN-20).
import {
  editBreakpoint,
  type ElementRef,
  type ElementSource,
  type Frame,
  type InteractionState,
  parseLocString,
  type ResponsiveMode,
  type Scope,
} from '@reactcraft/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createEventsClient, type StudioServerEvent } from '../../api/events-client.ts';
import { fetchElementSource } from '../../api/source-client.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useStructureErrorStore } from '../structure/structure-error-store.ts';
import type { InspectorLockReason, InspectorTarget, InspectorWarning } from './types.ts';

export type UseInspectorTargetOptions = {
  readonly frame?: Frame | undefined;
  readonly primaryFrame?: Frame | undefined;
  readonly responsiveMode?: ResponsiveMode | undefined;
  readonly enabled?: boolean | undefined;
};

export function computeWritePrefix(scope: Scope, mode: ResponsiveMode): string {
  const parts: string[] = [];
  if (scope.breakpoint !== 'base') {
    parts.push(mode === 'desktop-first' ? `max-${scope.breakpoint}` : scope.breakpoint);
  }
  if (scope.state !== undefined) {
    parts.push(scope.state);
  }
  return parts.length > 0 ? `${parts.join(':')}:` : '';
}

export function deriveLockReason(source: ElementSource | undefined): {
  readonly lockReason?: InspectorLockReason | undefined;
  readonly lockCode?: string | undefined;
} {
  if (source === undefined) return {};
  if (source.readonly === 'outsideSource') {
    return { lockReason: 'outsideSource' };
  }
  if (source.readonly === 'tooLarge') {
    return { lockReason: 'tooLarge' };
  }
  if (source.className.kind === 'expression') {
    return { lockReason: 'classExpression', lockCode: source.className.code };
  }
  if (source.className.kind === 'duplicate') {
    return { lockReason: 'classDuplicate' };
  }
  return {};
}

export function deriveWarnings(
  source: ElementSource | undefined,
  instances = 1,
): readonly InspectorWarning[] {
  if (source === undefined) return [];
  const warnings: InspectorWarning[] = [];
  if (source.component !== undefined && source.component.usages > 1) {
    warnings.push({
      kind: 'usages',
      count: source.component.usages,
      name: source.component.name,
    });
  }
  if (source.inLoop || instances > 1) {
    warnings.push({
      kind: 'loop',
      count: instances > 1 ? instances : 2,
    });
  }
  return warnings;
}

type LoaderState = {
  readonly locKey?: string | undefined;
  readonly refreshKey: number;
  readonly source?: ElementSource | undefined;
  readonly error?: string | undefined;
};

async function queryElementSource(loc: {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}): Promise<{ readonly source?: ElementSource | undefined; readonly error?: string | undefined }> {
  try {
    const res = await fetchElementSource({
      file: loc.file,
      line: loc.line,
      column: loc.column,
    });
    return { source: res, error: undefined };
  } catch (err: unknown) {
    return {
      source: undefined,
      error: err instanceof Error ? err.message : 'Lỗi nạp mã nguồn',
    };
  }
}

function useElementSourceLoader(
  enabled: boolean,
  loc: { readonly file: string; readonly line: number; readonly column: number } | undefined,
  refreshKey: number,
): {
  readonly source?: ElementSource | undefined;
  readonly loading: boolean;
  readonly error?: string | undefined;
} {
  const [data, setData] = useState<LoaderState>({ refreshKey: 0 });
  const currentLocKey =
    loc !== undefined ? `${loc.file}:${String(loc.line)}:${String(loc.column)}` : undefined;

  useEffect(() => {
    if (!enabled || loc === undefined) return undefined;
    const activeLoc = loc;
    let cancelled = false;

    async function load(): Promise<void> {
      const result = await queryElementSource(activeLoc);
      if (!cancelled) {
        setData({ locKey: currentLocKey, refreshKey, source: result.source, error: result.error });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, loc, currentLocKey, refreshKey]);

  if (!enabled || loc === undefined) {
    return { source: undefined, loading: false, error: undefined };
  }

  const sameElement = data.locKey === currentLocKey;
  const isUpToDate = sameElement && data.refreshKey === refreshKey;
  // While the same element reloads after a save, keep showing its last source: clearing it would
  // unmount every field and scroll the panel back to the top.
  return {
    source: sameElement ? data.source : undefined,
    loading: !isUpToDate,
    error: isUpToDate ? data.error : undefined,
  };
}

function useScopeCalculation(
  frame: Frame | undefined,
  primaryFrame: Frame | undefined,
  responsiveMode: ResponsiveMode,
  interactionState: InteractionState | undefined,
): { readonly currentScope: Scope; readonly writePrefix: string } {
  return useMemo(() => {
    const frameW = frame?.width ?? 1440;
    const primW = primaryFrame?.width ?? 1440;
    const breakpoint = editBreakpoint(frameW, primW, responsiveMode);
    const scope: Scope = { breakpoint, state: interactionState };
    return {
      currentScope: scope,
      writePrefix: computeWritePrefix(scope, responsiveMode),
    };
  }, [frame?.width, primaryFrame?.width, responsiveMode, interactionState]);
}

function useSyncActiveSource(singleRef: ElementRef | undefined, tag: string | undefined): void {
  const loc = singleRef?.loc;
  useEffect(() => {
    if (loc && tag) {
      useStructureErrorStore.getState().setActiveSource({ loc, tag });
    } else {
      useStructureErrorStore.getState().setActiveSource(undefined);
    }
  }, [loc, tag]);
}

export function useInspectorTarget(options: UseInspectorTargetOptions = {}): InspectorTarget {
  const { frame, primaryFrame, responsiveMode = 'desktop-first', enabled = true } = options;
  const selectedRefs = useSelectionStore((s) => s.selectedRefs);
  const selectionInfo = useSelectionStore((s) => s.selectionInfo);
  const [interactionState, setInteractionState] = useState<InteractionState | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const singleRef = selectedRefs.length === 1 ? selectedRefs[0] : undefined;
  const locParsed = useMemo(
    () => (singleRef !== undefined ? parseLocString(singleRef.loc) : undefined),
    [singleRef],
  );
  const { source, loading, error } = useElementSourceLoader(enabled, locParsed, refreshKey);
  const { currentScope, writePrefix } = useScopeCalculation(
    frame,
    primaryFrame,
    responsiveMode,
    interactionState,
  );
  useServerRefresh(enabled, locParsed?.file, refresh);
  useSyncActiveSource(singleRef, source?.tag);

  if (selectedRefs.length === 0) return { kind: 'empty' };
  if (selectedRefs.length > 1) return { kind: 'multiple', count: selectedRefs.length };
  if (singleRef === undefined) return { kind: 'empty' };

  const info = selectionInfo.find(
    (i) => i.ref.loc === singleRef.loc && i.ref.index === singleRef.index,
  );
  const { lockReason, lockCode } = deriveLockReason(source);
  const warnings = deriveWarnings(source, info?.instances ?? 1);

  return {
    kind: 'element',
    ref: singleRef,
    locFile: locParsed?.file,
    locLine: locParsed?.line,
    locCol: locParsed?.column,
    source,
    loading,
    error,
    lockReason,
    lockCode,
    warnings,
    currentScope,
    writePrefix,
    interactionState,
    setInteractionState,
    refresh,
  };
}

function useServerRefresh(
  enabled: boolean,
  activeFile: string | undefined,
  onRefresh: () => void,
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const schedule = useCallback(() => {
    if (timerRef.current !== undefined) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      onRefresh();
    }, 100);
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return undefined;
    const client = createEventsClient({
      onEvent: (event: StudioServerEvent) => {
        if (event.type === 'history.changed') {
          schedule();
        } else if (event.type === 'project.filesChanged') {
          const payload = event.payload as { readonly files?: readonly string[] } | undefined;
          if (activeFile !== undefined && payload?.files?.includes(activeFile)) {
            schedule();
          }
        }
      },
    });

    return () => {
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
      }
      client.close();
    };
  }, [enabled, activeFile, schedule]);
}
