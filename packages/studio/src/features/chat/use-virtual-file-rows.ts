'use no memo';
// Virtual row layout for long file lists (WP-3.05b, ADR-FE-21).
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';

export type VirtualFileRowsResult = {
  readonly items: readonly VirtualItem[];
  readonly totalSize: number;
};

export function useVirtualFileRows(
  count: number,
  scrollElement: HTMLDivElement,
): VirtualFileRowsResult {
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollElement,
    estimateSize: () => 28,
  });

  return {
    items: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
  };
}
