// Zoom of the Canvas (SPEC-04 R-RN-21): fixed steps, or "Fit" that follows the Canvas width.
import { type ChangeEvent, type RefObject, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type Zoom = number | 'fit';

const STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
/** Side padding of the Canvas viewport (`p-4`). */
const VIEWPORT_PADDING = 32;

/** "Fit": the frame as wide as the Canvas, never above 100% and never below 10%. */
export function fitZoom(viewportWidth: number, frameWidth: number): number {
  const available = viewportWidth - VIEWPORT_PADDING;
  if (available <= 0 || frameWidth <= 0) return 1;
  return Math.max(0.1, Math.min(1, available / frameWidth));
}

/** Width of an element, kept up to date while it resizes. */
export function useElementWidth(ref: RefObject<HTMLElement | undefined>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (element === undefined || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      setWidth(element.clientWidth);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return width;
}

export function ZoomSelect({
  zoom,
  onChange,
}: {
  readonly zoom: Zoom;
  readonly onChange: (zoom: Zoom) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="flex items-center gap-1.5 text-ink-soft">
      {t('editor.zoom')}
      <select
        value={zoom}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
          onChange(e.target.value === 'fit' ? 'fit' : Number(e.target.value));
        }}
        className="rounded border border-border bg-field px-2 py-1 text-ink"
        data-testid="canvas-zoom-select"
      >
        <option value="fit">{t('editor.zoomFit')}</option>
        {STEPS.map((step) => (
          <option key={step} value={step}>
            {`${String(step * 100)}%`}
          </option>
        ))}
      </select>
    </label>
  );
}
