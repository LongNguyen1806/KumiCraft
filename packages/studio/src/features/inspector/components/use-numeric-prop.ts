// What a number field with a slider reads, writes and previews (the owner, 2026-11-18): the value
// the code holds (Tailwind or plain CSS), the write once the drag ends, and the look on the
// Canvas while dragging, taken off when the written value comes back.
import type { ClassToken, ClassValue, PropertyId, Scope, StyleReading } from '@kumicraft/shared';
import { useEffect, useRef } from 'react';

import { studioBridgeChannel } from '../../selection/bridge-channel.ts';
import { useSelectionStore } from '../../selection/selection-store.ts';
import {
  cssValueOf,
  numberFromCss,
  numberFromTw,
  NUMERIC_FIELDS,
  type NumericField,
  previewDeclarations,
  twValueOf,
} from '../numeric-fields.ts';
import { readCssPropVal, readTwTokenStr } from './effects-helpers.ts';

export type NumericPropSource = {
  readonly editable: boolean;
  readonly tokens?: readonly ClassToken[] | undefined;
  readonly currentScope?: Scope | undefined;
  readonly major?: 3 | 4 | undefined;
  readonly cssReading?: StyleReading | undefined;
  readonly onPropChange?: ((prop: PropertyId, value: ClassValue | undefined) => void) | undefined;
  readonly onCssCommit?: ((property: string, value: string) => Promise<void> | void) | undefined;
};

/** If the written value never comes back (a failed write), the preview still goes. */
const PREVIEW_FALLBACK_MS = 3000;

function readRaw(source: NumericPropSource, prop: PropertyId): string {
  const scope = source.currentScope ?? { breakpoint: 'base' };
  return source.editable
    ? readTwTokenStr(source.tokens ?? [], scope, prop)
    : readCssPropVal(source.cssReading, prop);
}

function readNumber(source: NumericPropSource, f: NumericField): number | undefined {
  const raw = readRaw(source, f.prop);
  return source.editable ? numberFromTw(f, raw) : numberFromCss(f, raw);
}

/** The numbers every slider field holds now, for a preview that shows them all. */
function allNumbers(source: NumericPropSource): Partial<Record<PropertyId, number>> {
  const out: Partial<Record<PropertyId, number>> = {};
  for (const f of Object.values(NUMERIC_FIELDS)) {
    const n = readNumber(source, f);
    if (n !== undefined) out[f.prop] = n;
  }
  return out;
}

function stopPreview(
  previewing: { current: boolean },
  fallback: { current: ReturnType<typeof setTimeout> | undefined },
): void {
  clearTimeout(fallback.current);
  if (!previewing.current) return;
  previewing.current = false;
  studioBridgeChannel.clearStylePreview();
}

export function useNumericProp(source: NumericPropSource, f: NumericField) {
  const value = readNumber(source, f);
  const raw = readRaw(source, f.prop);
  const refs = useSelectionStore((s) => s.selectedRefs);
  const previewing = useRef(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const endPreview = () => {
    stopPreview(previewing, fallback);
  };
  // The written value is back in the code: the Canvas shows the real class from now on.
  useEffect(() => {
    stopPreview(previewing, fallback);
  }, [value]);

  // A state (hover…) is not what the Canvas shows at rest: no preview there, only the write.
  const canPreview = source.currentScope?.state === undefined;
  const onPreview = (n: number) => {
    if (!canPreview) return;
    const decls = previewDeclarations(f.prop, { ...allNumbers(source), [f.prop]: n });
    for (const ref of refs) {
      for (const d of decls) studioBridgeChannel.sendStylePreview(ref, d.property, d.value);
    }
    previewing.current = decls.length > 0;
  };
  const onCommit = (n: number | undefined) => {
    if (source.editable && source.onPropChange !== undefined) {
      source.onPropChange(f.prop, n === undefined ? undefined : twValueOf(f, n, source.major ?? 4));
    } else {
      void source.onCssCommit?.(f.prop, n === undefined ? '' : cssValueOf(f, n));
    }
    clearTimeout(fallback.current);
    fallback.current = setTimeout(endPreview, PREVIEW_FALLBACK_MS);
  };
  return {
    value,
    raw: value === undefined && raw !== '' ? raw : undefined,
    onPreview,
    onPreviewEnd: endPreview,
    onCommit,
  };
}
