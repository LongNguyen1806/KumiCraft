// Context menu to pick layers under pointer on Canvas (SPEC-04 R-SL-13, WP-2.12c).
import type { ElementRef, LayerMenuItem } from '@kumicraft/shared';
import { parseLocString } from '@kumicraft/shared';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useLayerMenuStore } from './layer-menu-store.ts';

export function fileComponentLabel(loc: string): string {
  const parsed = parseLocString(loc);
  if (!parsed) return '';
  const file = parsed.file;
  const base = file.slice(file.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot === -1 ? base : base.slice(0, dot);
}

function isRefSelected(ref: ElementRef, selectedRefs: readonly ElementRef[]): boolean {
  return selectedRefs.some((r) => r.loc === ref.loc && r.index === ref.index);
}

function handleShiftClick(item: LayerMenuItem, selectedRefs: readonly ElementRef[]): void {
  const isSelected = isRefSelected(item.ref, selectedRefs);
  if (isSelected) {
    const remaining = selectedRefs.filter(
      (r) => !(r.loc === item.ref.loc && r.index === item.ref.index),
    );
    if (remaining.length > 0) {
      useSelectionStore.getState().setSelectedRefs(remaining);
      studioBridgeChannel.select(remaining, false);
    }
    return;
  }
  const next = [...selectedRefs, item.ref];
  useSelectionStore.getState().setSelectedRefs(next);
  studioBridgeChannel.select(next, false);
}

function handleItemClick(item: LayerMenuItem, isShift: boolean): void {
  const selectedRefs = useSelectionStore.getState().selectedRefs;
  if (isShift) {
    handleShiftClick(item, selectedRefs);
  } else {
    useSelectionStore.getState().setSelectedRefs([item.ref]);
    studioBridgeChannel.select([item.ref], false);
  }
  studioBridgeChannel.highlight(undefined);
  useSelectionStore.getState().setHoveredRef(undefined);
  useLayerMenuStore.getState().close();
}

function useClickOutside(menuRef: { readonly current?: HTMLDivElement | undefined }): void {
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target;
      if (menuRef.current && target instanceof Node && !menuRef.current.contains(target)) {
        studioBridgeChannel.highlight(undefined);
        useSelectionStore.getState().setHoveredRef(undefined);
        useLayerMenuStore.getState().close();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [menuRef]);
}

type LayerMenuItemRowProps = {
  readonly item: LayerMenuItem;
  readonly isSelected: boolean;
  readonly showFileLabel: boolean;
  readonly fileLabel: string;
};

function LayerMenuItemRow(props: LayerMenuItemRowProps) {
  const { item, isSelected, showFileLabel, fileLabel } = props;
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={isSelected}
      data-testid="layer-menu-item"
      data-loc={item.ref.loc}
      onClick={(e) => {
        handleItemClick(item, e.shiftKey);
      }}
      onMouseEnter={() => {
        studioBridgeChannel.highlight(item.ref);
        useSelectionStore.getState().setHoveredRef(item.ref);
      }}
      className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-field-hover ${
        isSelected ? 'bg-primary/10 font-medium text-primary' : 'text-ink'
      }`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="font-mono text-xs">{item.tag}</span>
        {item.label !== undefined && (
          <span className="truncate text-xs text-ink-soft">{item.label}</span>
        )}
      </div>
      {showFileLabel && (
        <span
          data-testid="layer-menu-file"
          className="shrink-0 rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary"
        >
          {fileLabel}
        </span>
      )}
    </button>
  );
}

function LayerMenuItemsList({
  items,
  selectedRefs,
}: {
  readonly items: readonly LayerMenuItem[];
  readonly selectedRefs: readonly ElementRef[];
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item, i) => {
        const currentFile = parseLocString(item.ref.loc)?.file;
        const prevFile = i > 0 ? parseLocString(items[i - 1]?.ref.loc ?? '')?.file : undefined;
        const showFileLabel = i > 0 && currentFile !== undefined && currentFile !== prevFile;
        const fileLabel = showFileLabel ? fileComponentLabel(item.ref.loc) : '';
        const isSelected = isRefSelected(item.ref, selectedRefs);

        return (
          <LayerMenuItemRow
            key={`${item.ref.loc}#${String(item.ref.index)}`}
            item={item}
            isSelected={isSelected}
            showFileLabel={showFileLabel}
            fileLabel={fileLabel}
          />
        );
      })}
    </div>
  );
}

const MENU_WIDTH_PX = 240; // w-60
const MENU_MAX_HEIGHT_PX = 320; // max-h-80

/**
 * Anchors the menu at the pointer, opening up and/or left when it would overflow the zoomed
 * Canvas box (`boxWidth` × `boxHeight`, px). Without a box size it always opens down-right.
 */
export function menuPlacement(
  left: number,
  top: number,
  boxWidth?: number,
  boxHeight?: number,
): { left?: string; right?: string; top?: string; bottom?: string; maxHeight: string } {
  const width = boxWidth ?? Number.POSITIVE_INFINITY;
  const height = boxHeight ?? Number.POSITIVE_INFINITY;
  const horizontal =
    left + MENU_WIDTH_PX > width
      ? { right: `${String(width - left)}px` }
      : { left: `${String(left)}px` };
  // Open upward only when it overflows below and there is more room above the pointer.
  const flipY = top + MENU_MAX_HEIGHT_PX > height && top > height / 2;
  const vertical = flipY ? { bottom: `${String(height - top)}px` } : { top: `${String(top)}px` };
  const room = flipY ? top : height - top;
  return {
    ...horizontal,
    ...vertical,
    maxHeight: `${String(Math.min(MENU_MAX_HEIGHT_PX, room))}px`,
  };
}

export function LayerMenu({
  boxWidth,
  boxHeight,
}: {
  readonly boxWidth?: number | undefined;
  readonly boxHeight?: number | undefined;
}) {
  const { t } = useTranslation();
  const menu = useLayerMenuStore((s) => s.menu);
  const mode = useCanvasViewStore((s) => s.mode);
  const displayedZoom = useCanvasViewStore((s) => s.displayedZoom);
  const selectedRefs = useSelectionStore((s) => s.selectedRefs);
  const menuRef = useRef<HTMLDivElement>(undefined);

  useClickOutside(menuRef);

  useEffect(() => {
    if (mode === 'preview') {
      useLayerMenuStore.getState().close();
      studioBridgeChannel.highlight(undefined);
    }
  }, [mode]);

  if (mode === 'preview' || !menu) return <></>;

  const placement = menuPlacement(
    menu.x * displayedZoom,
    menu.y * displayedZoom,
    boxWidth,
    boxHeight,
  );

  return (
    <div
      ref={(el) => {
        menuRef.current = el ?? undefined;
      }}
      role="menu"
      tabIndex={-1}
      data-testid="layer-menu"
      onMouseLeave={() => {
        studioBridgeChannel.highlight(undefined);
        useSelectionStore.getState().setHoveredRef(undefined);
      }}
      style={placement}
      className="absolute z-40 flex w-60 flex-col overflow-y-auto rounded-lg border border-border bg-card-solid/95 p-1 text-ink shadow-2xl backdrop-blur-md"
    >
      <div className="px-2 py-1 text-[11px] font-semibold text-ink-soft">
        {t('layerMenu.title', 'Chọn lớp')}
      </div>
      <LayerMenuItemsList items={menu.items} selectedRefs={selectedRefs} />
    </div>
  );
}
