// @vitest-environment happy-dom
// Canvas navigation from inside the page (Ctrl + wheel zooms, the wheel button pans).
import { afterEach, describe, expect, it, vi } from 'vitest';

import { attachCanvasInput } from './canvas-input.ts';

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
});

describe('canvas input [WP-4.00]', () => {
  it('forwards Ctrl + wheel as a zoom at the pointer and keeps the browser from zooming the page', () => {
    const send = vi.fn();
    stop = attachCanvasInput(send);
    const wheel = new WheelEvent('wheel', {
      deltaY: -100,
      ctrlKey: true,
      clientX: window.innerWidth / 2,
      clientY: 0,
      cancelable: true,
    });
    // happy-dom leaves ctrlKey and the pointer of a WheelEvent undefined; a browser sets them.
    Object.defineProperty(wheel, 'ctrlKey', { value: true });
    Object.defineProperty(wheel, 'clientX', { value: window.innerWidth / 2 });
    Object.defineProperty(wheel, 'clientY', { value: 0 });
    window.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(send).toHaveBeenCalledWith('canvas-zoom', { deltaY: -100, x: 0.5, y: 0 });

    // A plain wheel still scrolls the page: nothing forwarded, nothing prevented.
    send.mockClear();
    const plain = new WheelEvent('wheel', { deltaY: 100, cancelable: true });
    window.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('forwards a wheel-button drag in screen pixels and hides it from the other listeners', () => {
    const send = vi.fn();
    stop = attachCanvasInput(send);
    const other = vi.fn();
    window.addEventListener('pointerdown', other, true);
    document.documentElement.setPointerCapture = vi.fn();
    const down = new PointerEvent('pointerdown', {
      button: 1,
      pointerId: 7,
      screenX: 10,
      screenY: 20,
      cancelable: true,
    });
    window.dispatchEvent(down);
    window.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 7, screenX: 30, screenY: 25 }),
    );
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, screenX: 30, screenY: 25 }));
    window.removeEventListener('pointerdown', other, true);

    expect(down.defaultPrevented).toBe(true);
    expect(other).not.toHaveBeenCalled();
    expect(send.mock.calls).toEqual([
      ['canvas-pan', { phase: 'start', screenX: 10, screenY: 20 }],
      ['canvas-pan', { phase: 'move', screenX: 30, screenY: 25 }],
      ['canvas-pan', { phase: 'end', screenX: 30, screenY: 25 }],
    ]);

    // The left button is not a pan.
    send.mockClear();
    window.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: 8 }));
    expect(send).not.toHaveBeenCalled();
  });
});
