import { Magnet } from 'lucide-react';
import { type ChangeEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useBridgeChannel } from '../selection/bridge-channel.ts';
import { CANVAS_GRID_SIZES, type CanvasGridSize, useCanvasViewStore } from './canvas-view-store.ts';

/**
 * Snap on or off (spec-log #125). The Bridge gets the switch and the zoom with the grid, again on
 * every change, so the snap reach stays the same on screen at any zoom.
 */
function SnapToggle() {
  const { t } = useTranslation();
  const snap = useCanvasViewStore((s) => s.snap);
  const setSnap = useCanvasViewStore((s) => s.setSnap);
  const grid = useCanvasViewStore((s) => s.grid);
  const zoom = useCanvasViewStore((s) => s.displayedZoom);
  const bridgeChannel = useBridgeChannel();

  useEffect(() => {
    bridgeChannel.setGrid(grid);
  }, [bridgeChannel, grid, snap, zoom]);

  return (
    <button
      type="button"
      aria-pressed={snap}
      title={t('editor.snapHint')}
      onClick={() => {
        setSnap(!snap);
      }}
      data-testid="canvas-snap-toggle"
      className="flex h-6 items-center gap-1 rounded-md border border-line px-2 text-ink-soft hover:text-ink aria-pressed:border-accent aria-pressed:text-accent"
    >
      <Magnet className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="@max-[1240px]:sr-only">{t('editor.snap')}</span>
    </button>
  );
}

export function GridSelect() {
  const { t } = useTranslation();
  const grid = useCanvasViewStore((s) => s.grid);
  const setGrid = useCanvasViewStore((s) => s.setGrid);
  const bridgeChannel = useBridgeChannel();

  return (
    <>
      <label className="flex items-center gap-1.5 text-ink-soft">
        <span className="@max-[1240px]:sr-only">{t('editor.grid', 'Lưới')}</span>
        <select
          value={grid}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            const val = Number(e.target.value) as CanvasGridSize;
            setGrid(val);
            bridgeChannel.setGrid(val);
          }}
          className="h-6 rounded-md border border-line bg-field px-2 py-0 text-ink"
          data-testid="canvas-grid-select"
        >
          {CANVAS_GRID_SIZES.map((size) => (
            <option key={size} value={size}>
              {t('editor.gridSize', '{{size}}px', { size })}
            </option>
          ))}
        </select>
      </label>
      <SnapToggle />
    </>
  );
}
