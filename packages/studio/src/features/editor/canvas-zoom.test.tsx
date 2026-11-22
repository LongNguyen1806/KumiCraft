// Zoom of the Canvas (R-RN-21).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { useCanvasViewStore } from '../../core/canvas-view-store.ts';
import { initI18n } from '../../i18n/i18n.ts';
import {
  CanvasZoomSlider,
  fitZoomForFocus,
  fitZoomForFrames,
  FRAME_TILE_GAP,
  FRAME_TILE_MIN_WIDTH,
  frameTileWidth,
} from './canvas-zoom.tsx';

describe('Canvas zoom [R-RN-21]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
  });

  it('fits one frame inside the Canvas, row padding and border included, never above 100% or below 10%', () => {
    // The row's padding on both sides and the tile's 1 px borders take room too: without them the
    // frame came out about 66 px too wide and was cut at the right edge on the first open.
    const zoom = fitZoomForFrames(1112, [1440]);
    const tile = 1440 * zoom + FRAME_TILE_GAP * 2 + 2;
    expect(tile).toBeLessThanOrEqual(1112 - 32 + 0.5);
    expect(tile).toBeGreaterThan(1112 - 32 - 2);
    expect(fitZoomForFrames(1600, [375])).toBe(1);
    expect(fitZoomForFrames(100, [1440])).toBe(0.1);
    expect(fitZoomForFrames(0, [1440])).toBe(1);
  });

  it('[WP-4.00] fits a row of frames, counting tiles held at their minimum width and the gaps (M-MF)', () => {
    const viewport = 595;
    const widths = [1440, 375];
    const zoom = fitZoomForFrames(viewport, widths);
    // The Mobile tile stays at its minimum width; the Desktop one takes what is left.
    expect(375 * zoom).toBeLessThan(FRAME_TILE_MIN_WIDTH);
    const row =
      widths.reduce((acc, w) => acc + frameTileWidth(w, zoom) + 2, 0) +
      FRAME_TILE_GAP * (widths.length + 1);
    expect(row).toBeLessThanOrEqual(viewport - 32 + 0.5);
    expect(row).toBeGreaterThan(viewport - 32 - 2);
    // Never below 10 %, even when the minimum widths alone overflow.
    expect(fitZoomForFrames(300, [1440, 375, 375, 375])).toBe(0.1);
  });

  it('[WP-4.00] one frame at a time fits the frame in height too, title bar included', () => {
    // A tall Mobile frame in a wide Canvas: the height decides.
    const zoom = fitZoomForFocus({ width: 1100, height: 800 }, { width: 375, height: 812 });
    expect(812 * zoom).toBeLessThanOrEqual(800 - 130 + 0.5);
    expect(zoom).toBeLessThan(fitZoomForFrames(1100, [375]));
    // A wide Desktop frame in a narrow Canvas: the width decides.
    expect(fitZoomForFocus({ width: 600, height: 900 }, { width: 1440, height: 900 })).toBe(
      fitZoomForFrames(600, [1440]),
    );
  });

  it('provides slider and step controls with fit and reset buttons', () => {
    const onZoomChange = vi.fn();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onZoomFit = vi.fn();
    const onZoomReset = vi.fn();

    render(
      <CanvasZoomSlider
        zoom={1}
        displayedZoom={1}
        onZoomChange={onZoomChange}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onZoomFit={onZoomFit}
        onZoomReset={onZoomReset}
      />,
    );

    const fitBtn = screen.getByTestId('canvas-zoom-fit');
    fireEvent.click(fitBtn);
    expect(onZoomFit).toHaveBeenCalledTimes(1);

    const outBtn = screen.getByTestId('canvas-zoom-out');
    fireEvent.click(outBtn);
    expect(onZoomOut).toHaveBeenCalledTimes(1);

    const inBtn = screen.getByTestId('canvas-zoom-in');
    fireEvent.click(inBtn);
    expect(onZoomIn).toHaveBeenCalledTimes(1);

    const slider = screen.getByTestId('canvas-zoom-slider');
    expect(slider).toHaveProperty('value', '100');
    fireEvent.change(slider, { target: { value: '125' } });
    expect(onZoomChange).toHaveBeenCalledWith(1.25);

    const percentBtn = screen.getByTestId('canvas-zoom-percent');
    expect(percentBtn.textContent).toBe('100%');
    fireEvent.click(percentBtn);
    expect(onZoomReset).toHaveBeenCalledTimes(1);
  });

  it('steps out below 50 % and in up to 400 %, never the wrong way [R-RN-21]', () => {
    const view = useCanvasViewStore.getState();
    view.setZoom(0.3);
    view.zoomOut();
    expect(useCanvasViewStore.getState().zoom).toBe(0.25);
    view.setZoom(0.1);
    view.zoomOut();
    expect(useCanvasViewStore.getState().zoom).toBe(0.1);
    view.setZoom(3.5);
    view.zoomIn();
    expect(useCanvasViewStore.getState().zoom).toBe(4);
    view.zoomIn();
    expect(useCanvasViewStore.getState().zoom).toBe(4);
  });

  it('lets the slider reach the whole 10 %–400 % range [R-RN-21]', () => {
    const onZoomChange = vi.fn();
    render(<CanvasZoomSlider zoom={1} displayedZoom={1} onZoomChange={onZoomChange} />);
    const slider = screen.getByTestId('canvas-zoom-slider');
    expect(slider.getAttribute('min')).toBe('10');
    expect(slider.getAttribute('max')).toBe('400');
    fireEvent.change(slider, { target: { value: '400' } });
    expect(onZoomChange).toHaveBeenCalledWith(4);
  });
});
