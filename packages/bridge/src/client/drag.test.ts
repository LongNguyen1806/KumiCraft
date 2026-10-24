// @vitest-environment happy-dom
// Unit tests for DragController (SPEC-04 M-DD, R-DD-13, R-DD-14, R-DD-16, R-DD-17).
import type { BridgeDropTargetPayload, BridgeMoveIntentPayload } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DragController } from './drag.ts';
import type { DropEnv, DropRect, DropResult, LayoutAxis } from './drop-target.ts';

function elById(id: string): Element {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

describe('DragController [R-DD-13, R-DD-14, R-DD-16, R-DD-17]', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('scenario 11: pointermove across 3 positions (2 with same target) and pointerup sends deduplicated drop-target and 1 move-intent [R-DD-13, R-DD-14]', () => {
    document.body.innerHTML = `
      <section id="sec" data-rc-loc="src/Home.tsx:1:1">
        <div id="d1" data-rc-loc="src/Home.tsx:2:3">A</div>
        <div id="d2" data-rc-loc="src/Home.tsx:3:3">B</div>
        <div id="d3" data-rc-loc="src/Home.tsx:4:3">C</div>
      </section>
    `;
    const sec = elById('sec');
    const d1 = elById('d1');
    const d2 = elById('d2');
    const d3 = elById('d3');

    const rects = new Map<Element, DropRect>([
      [sec, { x: 0, y: 0, width: 300, height: 300 }],
      [d1, { x: 0, y: 0, width: 300, height: 100 }],
      [d2, { x: 0, y: 100, width: 300, height: 100 }],
      [d3, { x: 0, y: 200, width: 300, height: 100 }],
    ]);
    const axes = new Map<Element, LayoutAxis>([[sec, 'column']]);
    const env: DropEnv = {
      hitTest: (_x, y) => {
        if (y < 100) return [d1, sec];
        if (y < 200) return [d2, sec];
        return [d3, sec];
      },
      measure: (el) => rects.get(el) ?? { x: 0, y: 0, width: 0, height: 0 },
      axisOf: (el) => axes.get(el) ?? 'column',
    };

    const dropTargets: BridgeDropTargetPayload[] = [];
    const moveIntents: BridgeMoveIntentPayload[] = [];
    const indicators: (DropResult | undefined)[] = [];

    const controller = new DragController(
      env,
      {
        sendDropTarget: (p) => {
          dropTargets.push(p);
        },
        sendMoveIntent: (p) => {
          moveIntents.push(p);
        },
        showIndicator: (d) => {
          indicators.push(d);
        },
        showGridCells: () => {},
      },
      window,
    );

    controller.beginCanvasDrag([d1], 50, 20);
    expect(controller.isDragging()).toBe(true);

    // Position 1: upper half of d2 -> before d2
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, clientY: 110 }));
    vi.advanceTimersByTime(20);

    // Position 2: still upper half of d2 -> same target (before d2)
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, clientY: 125 }));
    vi.advanceTimersByTime(20);

    // Position 3: lower half of d3 -> after d3
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, clientY: 280 }));
    vi.advanceTimersByTime(20);

    // Release
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 50, clientY: 280 }));

    expect(dropTargets).toHaveLength(3);
    expect(dropTargets[0]).toMatchObject({
      target: {
        kind: 'sibling',
        ref: { loc: 'src/Home.tsx:3:3', tag: 'div' },
        where: 'before',
      },
      label: 'section',
    });
    expect(dropTargets[1]).toMatchObject({
      target: {
        kind: 'sibling',
        ref: { loc: 'src/Home.tsx:4:3', tag: 'div' },
        where: 'after',
      },
      label: 'section',
    });
    expect(dropTargets[2]).toEqual({});

    expect(moveIntents).toEqual([
      {
        elements: [{ loc: 'src/Home.tsx:2:3', tag: 'div' }],
        target: {
          kind: 'sibling',
          ref: { loc: 'src/Home.tsx:4:3', tag: 'div' },
          where: 'after',
        },
      },
    ]);
    expect(indicators[indicators.length - 1]).toBeUndefined();

    controller.destroy();
  });

  it('scenario 12: cancel() suppresses move-intent; elements with different parents do not start dragging [R-DD-17]', () => {
    document.body.innerHTML = `
      <div id="p1" data-rc-loc="src/Home.tsx:1:1">
        <span id="s1" data-rc-loc="src/Home.tsx:2:3">One</span>
        <span id="s2" data-rc-loc="src/Home.tsx:3:3">Two</span>
      </div>
      <div id="p2" data-rc-loc="src/Home.tsx:4:1">
        <span id="s3" data-rc-loc="src/Home.tsx:5:3">Three</span>
      </div>
    `;
    const p1 = elById('p1');
    const s1 = elById('s1');
    const s2 = elById('s2');
    const s3 = elById('s3');

    const rects = new Map<Element, DropRect>([
      [p1, { x: 0, y: 0, width: 200, height: 200 }],
      [s1, { x: 0, y: 0, width: 200, height: 50 }],
      [s2, { x: 0, y: 50, width: 200, height: 50 }],
    ]);
    const env: DropEnv = {
      hitTest: () => [s2, p1],
      measure: (el) => rects.get(el) ?? { x: 0, y: 0, width: 0, height: 0 },
      axisOf: () => 'column',
    };

    const moveIntents: BridgeMoveIntentPayload[] = [];
    const dropTargets: BridgeDropTargetPayload[] = [];

    const controller = new DragController(
      env,
      {
        sendDropTarget: (p) => {
          dropTargets.push(p);
        },
        sendMoveIntent: (p) => {
          moveIntents.push(p);
        },
        showIndicator: () => {},
        showGridCells: () => {},
      },
      window,
    );

    // 1. Different parents -> does not start drag
    controller.beginCanvasDrag([s1, s3], 10, 10);
    expect(controller.isDragging()).toBe(false);

    // 2. Valid drag then cancel() -> no move-intent even if pointerup fires
    controller.beginCanvasDrag([s1], 10, 10);
    expect(controller.isDragging()).toBe(true);
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 80 }));
    vi.advanceTimersByTime(20);

    controller.cancel();
    expect(controller.isDragging()).toBe(false);
    expect(dropTargets[dropTargets.length - 1]).toEqual({});

    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 10, clientY: 80 }));
    expect(moveIntents).toEqual([]);

    controller.destroy();
  });

  it('scenario 13: auto-scrolls when y=10 and stops when y=300 for innerHeight=600 [R-DD-16]', () => {
    document.body.innerHTML = '<div id="box" data-rc-loc="src/Home.tsx:1:1"></div>';
    const box = elById('box');
    const env: DropEnv = {
      hitTest: () => [box],
      measure: () => ({ x: 0, y: 0, width: 400, height: 600 }),
      axisOf: () => 'column',
    };

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
    const scrollSpy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});

    const controller = new DragController(
      env,
      {
        sendDropTarget: () => {},
        sendMoveIntent: () => {},
        showIndicator: () => {},
        showGridCells: () => {},
      },
      window,
    );

    controller.beginCanvasDrag([box], 100, 100);

    // Move to y = 10 (< 40 px top margin)
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 10 }));
    vi.advanceTimersByTime(20);
    expect(scrollSpy).toHaveBeenCalledWith(0, -12);

    // Move to y = 300 (middle of 600 px height) -> should not scroll further
    scrollSpy.mockClear();
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 300 }));
    vi.advanceTimersByTime(50);
    expect(scrollSpy).not.toHaveBeenCalled();

    controller.destroy();
  });
});
