// Canvas navigation: wheel zoom pace and Bridge messages placed on the frame (WP-4.00).
import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleCanvasNavigation } from '../selection/canvas-navigation-messages.ts';
import { onCanvasPan, onCanvasZoom, zoomAfterWheel } from './canvas-navigation.ts';
import { MAX_ZOOM, MIN_ZOOM } from './canvas-view-store.ts';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('canvas navigation [WP-4.00]', () => {
  it('zooms in on a wheel up, out on a wheel down, within 10 %–400 %', () => {
    expect(zoomAfterWheel(1, -100)).toBeGreaterThan(1.1);
    expect(zoomAfterWheel(1, 100)).toBeLessThan(0.9);
    expect(zoomAfterWheel(1, 100)).toBeCloseTo(1 / zoomAfterWheel(1, -100), 5);
    expect(zoomAfterWheel(MAX_ZOOM, -500)).toBe(MAX_ZOOM);
    expect(zoomAfterWheel(MIN_ZOOM, 500)).toBe(MIN_ZOOM);
  });

  it('places a zoom from inside a frame at the same spot on the frame element, and a pan as is', () => {
    const iframe = document.createElement('iframe');
    iframe.srcdoc = '<!doctype html><title>page</title>';
    document.body.appendChild(iframe);
    vi.spyOn(iframe, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 400, 300));
    const zooms = vi.fn();
    const pans = vi.fn();
    const offZoom = onCanvasZoom(zooms);
    const offPan = onCanvasPan(pans);
    const win = iframe.contentWindow ?? undefined;

    expect(handleCanvasNavigation('canvas-zoom', { deltaY: -100, x: 0.25, y: 0.5 }, win)).toBe(
      true,
    );
    expect(zooms).toHaveBeenCalledWith({ x: 200, y: 200, deltaY: -100 });
    expect(
      handleCanvasNavigation('canvas-pan', { phase: 'move', screenX: 5, screenY: 6 }, win),
    ).toBe(true);
    expect(pans).toHaveBeenCalledWith({ phase: 'move', screen: { x: 5, y: 6 } });

    // A bad payload is swallowed; another type is left to the other handlers.
    zooms.mockClear();
    expect(handleCanvasNavigation('canvas-zoom', { deltaY: 'x' }, win)).toBe(true);
    expect(zooms).not.toHaveBeenCalled();
    expect(handleCanvasNavigation('select', { refs: [] }, win)).toBe(false);
    offZoom();
    offPan();
  });
});
