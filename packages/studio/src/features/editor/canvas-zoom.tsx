// Zoom of the Canvas (SPEC-04 R-RN-21): slider, in/out buttons, or "Fit" that follows the Canvas width.
import { type ChangeEvent, type RefObject, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MAX_ZOOM, MIN_ZOOM, useCanvasViewStore } from './canvas-view-store.ts';

export type Zoom = number | 'fit';

/** Side padding of the Canvas viewport (`p-4`). */
const VIEWPORT_PADDING = 32;

/** A frame tile never gets narrower than its title bar needs (name, size, session, close). */
export const FRAME_TILE_MIN_WIDTH = 220;
/** Space between frame tiles, and around the row of tiles, in Canvas pixels (not zoomed). */
export const FRAME_TILE_GAP = 32;
/** The 1 px border on both sides of a tile, which the zoom does not scale. */
const FRAME_TILE_BORDER = 2;

/** On-screen width of a frame tile at a zoom. */
export function frameTileWidth(frameWidth: number, zoom: number): number {
  return Math.max(frameWidth * zoom, FRAME_TILE_MIN_WIDTH);
}

/**
 * "Fit" (R-RN-21): the zoom that fits a row of frames, one or more, side by side (M-MF), never
 * above 100% and never below 10%. The row's padding and gaps and the tile borders take fixed room
 * (one frame too: it used to skip them and came out about 66 px too wide, cut at the right edge);
 * tiles held at their minimum width take theirs, the others share what is left by their width.
 */
export function fitZoomForFrames(viewportWidth: number, frameWidths: readonly number[]): number {
  if (frameWidths.length === 0 || viewportWidth <= 0) return 1;
  const fixed = (FRAME_TILE_GAP + FRAME_TILE_BORDER) * frameWidths.length + FRAME_TILE_GAP;
  let pinned = new Set<number>();
  let zoom = 1;
  for (let round = 0; round <= frameWidths.length; round += 1) {
    const free = frameWidths.filter((_, i) => !pinned.has(i));
    const room = viewportWidth - VIEWPORT_PADDING - fixed - pinned.size * FRAME_TILE_MIN_WIDTH;
    const sum = free.reduce((acc, w) => acc + w, 0);
    zoom = sum > 0 && room > 0 ? Math.max(0.1, Math.min(1, room / sum)) : 0.1;
    const next = new Set(
      frameWidths.flatMap((w, i) => (w * zoom < FRAME_TILE_MIN_WIDTH ? [i] : [])),
    );
    if (next.size === pinned.size) break;
    pinned = next;
  }
  return zoom;
}

/** Width of an element, kept up to date while it resizes. */
/** Width and height of an element, kept up to date while it resizes. */
export function useElementSize(ref: RefObject<HTMLElement | undefined>): {
  readonly width: number;
  readonly height: number;
} {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (element === undefined || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      setSize({ width: element.clientWidth, height: element.clientHeight });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return size;
}

/**
 * Room around a frame shown alone, top to bottom: the Canvas and row padding and the frame's title
 * bar, so the whole frame is in view.
 */
const FOCUS_VERTICAL_ROOM = 130;

/** One frame at a time: the zoom that fits the frame in both width and height. */
export function fitZoomForFocus(
  viewport: { readonly width: number; readonly height: number },
  frame: { readonly width: number; readonly height: number },
): number {
  const byWidth = fitZoomForFrames(viewport.width, [frame.width]);
  const room = viewport.height - FOCUS_VERTICAL_ROOM;
  if (viewport.height <= 0 || frame.height <= 0) return byWidth;
  return Math.max(0.1, Math.min(byWidth, room / frame.height));
}

export type CanvasZoomSliderProps = {
  readonly zoom?: Zoom | undefined;
  readonly displayedZoom?: number | undefined;
  readonly onZoomChange?: ((zoom: Zoom) => void) | undefined;
  readonly onZoomIn?: (() => void) | undefined;
  readonly onZoomOut?: (() => void) | undefined;
  readonly onZoomFit?: (() => void) | undefined;
  readonly onZoomReset?: (() => void) | undefined;
};

type ZoomFitButtonProps = {
  readonly isFit: boolean;
  readonly onFit: () => void;
};

function ZoomFitButton({ isFit, onFit }: ZoomFitButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid="canvas-zoom-fit"
      title={t('editor.zoomFit')}
      onClick={onFit}
      className={`rounded px-2 py-0.5 text-xs transition-colors ${
        isFit
          ? 'border border-border bg-field font-medium text-ink shadow-xs'
          : 'text-ink-soft hover:bg-field hover:text-ink'
      }`}
    >
      {t('editor.zoomFit')}
    </button>
  );
}

type ZoomSliderInputProps = {
  readonly percent: number;
  readonly onChange: (zoom: number) => void;
};

function ZoomSliderInput({ percent, onChange }: ZoomSliderInputProps) {
  const { t } = useTranslation();
  return (
    <input
      type="range"
      min={MIN_ZOOM * 100}
      max={MAX_ZOOM * 100}
      step={5}
      value={percent}
      aria-label={t('editor.zoom')}
      data-testid="canvas-zoom-slider"
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        onChange(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(e.target.value) / 100)));
      }}
      className="h-1 w-20 cursor-pointer accent-ink-soft bg-border rounded-lg"
    />
  );
}

type ZoomRangeProps = {
  readonly displayedZoom: number;
  readonly percent: number;
  readonly onZoomChange: (zoom: number) => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onZoomReset: () => void;
};

function ZoomRangeControls({
  displayedZoom,
  percent,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: ZoomRangeProps) {
  const { t } = useTranslation();
  return (
    <>
      <button
        type="button"
        data-testid="canvas-zoom-out"
        title={t('shortcuts.actions.zoomOut')}
        aria-label={t('shortcuts.actions.zoomOut')}
        onClick={onZoomOut}
        disabled={displayedZoom <= MIN_ZOOM}
        className="flex size-5 items-center justify-center rounded text-sm text-ink-soft transition-colors hover:bg-field hover:text-ink disabled:opacity-30"
      >
        −
      </button>
      <ZoomSliderInput percent={percent} onChange={onZoomChange} />
      <button
        type="button"
        data-testid="canvas-zoom-in"
        title={t('shortcuts.actions.zoomIn')}
        aria-label={t('shortcuts.actions.zoomIn')}
        onClick={onZoomIn}
        disabled={displayedZoom >= MAX_ZOOM}
        className="flex size-5 items-center justify-center rounded text-sm text-ink-soft transition-colors hover:bg-field hover:text-ink disabled:opacity-30"
      >
        +
      </button>
      <button
        type="button"
        data-testid="canvas-zoom-percent"
        title={t('shortcuts.actions.zoomReset')}
        onClick={onZoomReset}
        className="w-11 text-right font-mono text-xs text-ink-soft transition-colors hover:text-ink"
      >
        {`${String(percent)}%`}
      </button>
    </>
  );
}

export function CanvasZoomSlider(props: CanvasZoomSliderProps = {}) {
  const storeZoom = useCanvasViewStore((s) => s.zoom);
  const storeDisplayed = useCanvasViewStore((s) => s.displayedZoom);
  const storeSetZoom = useCanvasViewStore((s) => s.setZoom);
  const storeZoomIn = useCanvasViewStore((s) => s.zoomIn);
  const storeZoomOut = useCanvasViewStore((s) => s.zoomOut);
  const storeZoomFit = useCanvasViewStore((s) => s.zoomFit);
  const storeZoomReset = useCanvasViewStore((s) => s.zoomReset);

  const zoom = props.zoom ?? storeZoom;
  const displayedZoom = props.displayedZoom ?? storeDisplayed;
  const setZoom = props.onZoomChange ?? storeSetZoom;
  const zoomIn = props.onZoomIn ?? storeZoomIn;
  const zoomOut = props.onZoomOut ?? storeZoomOut;
  const zoomFit = props.onZoomFit ?? storeZoomFit;
  const zoomReset = props.onZoomReset ?? storeZoomReset;

  const isFit = zoom === 'fit';
  const percent = Math.round(displayedZoom * 100);

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-ink-soft select-none"
      data-testid="canvas-zoom-control"
    >
      <ZoomFitButton isFit={isFit} onFit={zoomFit} />
      <ZoomRangeControls
        displayedZoom={displayedZoom}
        percent={percent}
        onZoomChange={setZoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
      />
    </div>
  );
}
