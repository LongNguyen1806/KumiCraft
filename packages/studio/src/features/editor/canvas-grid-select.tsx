import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useBridgeChannel } from '../selection/bridge-channel.ts';
import { CANVAS_GRID_SIZES, type CanvasGridSize, useCanvasViewStore } from './canvas-view-store.ts';

export function GridSelect() {
  const { t } = useTranslation();
  const grid = useCanvasViewStore((s) => s.grid);
  const setGrid = useCanvasViewStore((s) => s.setGrid);
  const bridgeChannel = useBridgeChannel();

  return (
    <label className="flex items-center gap-1.5 text-ink-soft">
      {t('editor.grid', 'Lưới')}
      <select
        value={grid}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
          const val = Number(e.target.value) as CanvasGridSize;
          setGrid(val);
          bridgeChannel.setGrid(val);
        }}
        className="rounded border border-border bg-field px-2 py-1 text-ink"
        data-testid="canvas-grid-select"
      >
        {CANVAS_GRID_SIZES.map((size) => (
          <option key={size} value={size}>
            {t('editor.gridSize', '{{size}}px', { size })}
          </option>
        ))}
      </select>
    </label>
  );
}
