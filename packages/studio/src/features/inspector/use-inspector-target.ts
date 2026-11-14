// Hook managing Inspector target selection, source fetching, and scope (SPEC-04 M-IN, R-IN-10..16, R-IN-20).
import {
  type ElementRef,
  type ElementSource,
  type Frame,
  type InspectorPreviewState,
  type InteractionState,
  parseLocString,
  projectBreakpoints,
  type ResponsiveMode,
  type Scope,
} from '@kumicraft/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createEventsClient, type StudioServerEvent } from '../../api/events-client.ts';
import { fetchElementSource } from '../../api/source-client.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useStructureErrorStore } from '../structure/structure-error-store.ts';
import type { InspectorLockReason, InspectorTarget, InspectorWarning } from './types.ts';
import { useMultiInspectorTarget } from './use-multi-inspector-target.ts';
import { useThemeStore } from './use-project-theme.ts';

export type UseInspectorTargetOptions = {
  readonly frame?: Frame | undefined;
  readonly primaryFrame?: Frame | undefined;
  readonly responsiveMode?: ResponsiveMode | undefined;
  readonly enabled?: boolean | undefined;
};

import { computeWritePrefix, useScopeCalculation } from './inspector-scope.ts';
export { computeWritePrefix, useScopeCalculation };

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

function buildElementTarget(
  singleRef: ElementRef,
  locParsed: { readonly file: string; readonly line: number; readonly column: number } | undefined,
  source: ElementSource | undefined,
  loader: { readonly loading: boolean; readonly error?: string | undefined },
  scope: { readonly currentScope: Scope; readonly writePrefix: string },
  instances: number,
  interaction: {
    readonly state: InteractionState | undefined;
    readonly setState: (s: InteractionState | undefined) => void;
    readonly previewState: InspectorPreviewState | undefined;
    readonly setPreviewState: (s: InspectorPreviewState | undefined) => void;
    readonly groupRef: ElementRef | undefined;
    readonly setGroupRef: (ref: ElementRef | undefined) => void;
  },
  refresh: () => void,
): InspectorTarget {
  const { lockReason, lockCode } = deriveLockReason(source);
  return {
    kind: 'element',
    ref: singleRef,
    locFile: locParsed?.file,
    locLine: locParsed?.line,
    locCol: locParsed?.column,
    source,
    loading: loader.loading,
    error: loader.error,
    lockReason,
    lockCode,
    warnings: deriveWarnings(source, instances),
    currentScope: scope.currentScope,
    writePrefix: scope.writePrefix,
    interactionState: interaction.state,
    setInteractionState: interaction.setState,
    previewState: interaction.previewState,
    setPreviewState: interaction.setPreviewState,
    groupRef: interaction.groupRef,
    setGroupRef: interaction.setGroupRef,
    refresh,
  };
}

function useInteractionPreviewControl(singleRef: ElementRef | undefined) {
  const [previewState, setPreviewState] = useState<InspectorPreviewState | undefined>(undefined);
  const [groupRef, setGroupRef] = useState<ElementRef | undefined>(undefined);
  const interactionState: InteractionState | undefined =
    previewState === 'loading' ? undefined : previewState;

  const setInteractionState = useCallback((next: InteractionState | undefined) => {
    setPreviewState(next);
  }, []);

  useEffect(() => {
    if (singleRef === undefined) return;
    studioBridgeChannel.setStatePreview(singleRef, previewState, groupRef);
  }, [singleRef, previewState, groupRef]);

  return {
    state: interactionState,
    setState: setInteractionState,
    previewState,
    setPreviewState,
    groupRef,
    setGroupRef,
  };
}

function useSingleInspectorTarget(
  options: UseInspectorTargetOptions,
  singleRef: ElementRef | undefined,
): InspectorTarget {
  const { frame, primaryFrame, responsiveMode = 'desktop-first', enabled = true } = options;
  const selectionInfo = useSelectionStore((s) => s.selectionInfo);
  const interaction = useInteractionPreviewControl(singleRef);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const locParsed = useMemo(
    () => (singleRef !== undefined ? parseLocString(singleRef.loc) : undefined),
    [singleRef],
  );
  const loader = useElementSourceLoader(enabled, locParsed, refreshKey);
  const theme = useThemeStore((s) => s.theme);
  const projectBps = useMemo(() => projectBreakpoints(theme), [theme]);
  const scope = useScopeCalculation(
    frame,
    primaryFrame,
    responsiveMode,
    interaction.state,
    projectBps,
  );
  useServerRefresh(enabled, locParsed?.file, refresh);
  useSyncActiveSource(singleRef, loader.source?.tag);

  if (singleRef === undefined) return { kind: 'empty' };

  const info = selectionInfo.find(
    (i) => i.ref.loc === singleRef.loc && i.ref.index === singleRef.index,
  );
  return buildElementTarget(
    singleRef,
    locParsed,
    loader.source,
    loader,
    scope,
    info?.instances ?? 1,
    interaction,
    refresh,
  );
}

export function useInspectorTarget(options: UseInspectorTargetOptions = {}): InspectorTarget {
  const selectedRefs = useSelectionStore((s) => s.selectedRefs);
  const singleRef = selectedRefs.length === 1 ? selectedRefs[0] : undefined;
  const singleTarget = useSingleInspectorTarget(options, singleRef);
  const multiTarget = useMultiInspectorTarget({
    ...options,
    enabled: (options.enabled ?? true) && selectedRefs.length > 1,
  });

  if (selectedRefs.length === 0) return { kind: 'empty' };
  if (selectedRefs.length > 1) return multiTarget;
  return singleTarget;
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
          // Undo or Redo rewrote the file: read it at once, so a field changed right after
          // starts from the restored class, not the undone one (K9.5, E017 otherwise).
          onRefresh();
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
  }, [enabled, activeFile, schedule, onRefresh]);
}
