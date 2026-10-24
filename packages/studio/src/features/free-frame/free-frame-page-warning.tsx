import { type ElementRef, type ElementSource, parseLocString } from '@kumicraft/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { freeFrameOfRef } from './free-context.ts';

export function isDraftFile(filePath: string, draftsDir: string): boolean {
  return filePath.startsWith(`${draftsDir.replace(/\/+$/, '')}/`);
}

function useIsChildOfFree(ref: ElementRef | undefined, isFree: boolean): boolean {
  const [isChild, setIsChild] = useState(false);
  const loc = ref?.loc;
  const index = ref?.index ?? 0;

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (loc === undefined || isFree) {
        setIsChild(false);
        return;
      }
      const frame = await freeFrameOfRef({ loc, index });
      if (!cancelled) {
        setIsChild(frame !== undefined);
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [loc, index, isFree]);

  return isChild;
}

export function FreeFramePageWarning({ source }: { readonly source?: ElementSource | undefined }) {
  const { t } = useTranslation();
  const draftsDir = useCanvasViewStore((s) => s.draftsDir);
  const selectedRefs = useSelectionStore((s) => s.selectedRefs);
  const primaryRef = selectedRefs[selectedRefs.length - 1];
  const ref =
    primaryRef?.loc === source?.loc
      ? primaryRef
      : source
        ? { loc: source.loc, index: 0 }
        : undefined;

  const isFree = source?.free === true;
  const isChildOfFree = useIsChildOfFree(ref, isFree);

  if (!source) return <></>;
  const filePath = parseLocString(source.loc)?.file ?? '';
  if (isDraftFile(filePath, draftsDir) || (!isFree && !isChildOfFree)) return <></>;

  return (
    <div
      role="alert"
      data-testid="free-frame-page-warning"
      className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-500"
    >
      {t(
        'freeFrame.pageWarning',
        'Khung tự do có thể vỡ trên màn hình nhỏ. Khuyên dùng trong Trang bản nháp.',
      )}
    </div>
  );
}
