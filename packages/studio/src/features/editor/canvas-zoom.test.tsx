// Zoom of the Canvas (R-RN-21).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { useCanvasViewStore } from './canvas-view-store.ts';
import { CanvasZoomSlider, fitZoom } from './canvas-zoom.tsx';

describe('Canvas zoom [R-RN-21]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
  });

  it('fits the frame to the Canvas width, never above 100% or below 10%', () => {
    expect(fitZoom(1112, 1440)).toBeCloseTo(0.75);
    expect(fitZoom(1600, 375)).toBe(1);
    expect(fitZoom(100, 1440)).toBe(0.1);
    expect(fitZoom(0, 1440)).toBe(1);
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
