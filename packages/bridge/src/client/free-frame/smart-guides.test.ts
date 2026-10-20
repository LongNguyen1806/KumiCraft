// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DropRect } from '../drop-target.ts';
import { FreeDragController } from './free-drag.ts';
import type { Measure } from './free-geometry.ts';
import { type GapMark, type GuideLine, snapEdge, snapMove } from './smart-guides.ts';

function pointer(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, { clientX: x, clientY: y, bubbles: true });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('smart-guides pure math [R-FF-18]', () => {
  it('[R-FF-18] scenario 1: snapMove snaps to sibling left edge and creates vertical line', () => {
    const moving = { left: 103, top: 80, width: 60, height: 40 };
    const others = [{ left: 100, top: 20, width: 50, height: 30 }];
    const frame = { width: 500, height: 400 };

    const result = snapMove(moving, others, frame);
    expect(result.left).toBe(100);
    expect(result.top).toBeUndefined();
    expect(result.lines).toEqual([{ axis: 'x', pos: 100, from: 20, to: 120 }]);
  });

  it('[R-FF-18] scenario 2: snapMove snaps to frame center and spans full frame', () => {
    const moving = { left: 197, top: 80, width: 100, height: 40 };
    const others: [] = [];
    const frame = { width: 500, height: 400 };

    const result = snapMove(moving, others, frame);
    expect(result.left).toBe(200);
    expect(result.top).toBeUndefined();
    expect(result.lines).toEqual([{ axis: 'x', pos: 250, from: 0, to: 400 }]);
  });

  it('[R-FF-18] scenario 3: snapMove when distance is 6px (> 4px) snaps to nothing', () => {
    const moving = { left: 146, top: 80, width: 60, height: 40 };
    const others = [{ left: 100, top: 20, width: 40, height: 30 }];
    const frame = { width: 500, height: 400 };

    const result = snapMove(moving, others, frame);
    expect(result.left).toBeUndefined();
    expect(result.top).toBeUndefined();
    expect(result.lines).toEqual([]);
    expect(result.gaps).toEqual([]);
  });

  it('[R-FF-18] scenario 4: snapMove snaps to equal gap between two siblings', () => {
    const moving = { left: 93, top: 20, width: 60, height: 40 };
    const others = [
      { left: 0, top: 20, width: 50, height: 40 },
      { left: 200, top: 20, width: 50, height: 40 },
    ];
    const frame = { width: 500, height: 400 };

    const result = snapMove(moving, others, frame);
    expect(result.left).toBe(95);
    expect(result.gaps).toEqual([
      { axis: 'x', from: 50, to: 95, at: 40 },
      { axis: 'x', from: 155, to: 200, at: 40 },
    ]);
  });

  it('[R-FF-18] scenario 5: snapMove does not snap equal gap when sibling does not overlap on perpendicular axis', () => {
    const moving = { left: 93, top: 20, width: 60, height: 40 };
    const others = [
      { left: 0, top: 20, width: 50, height: 40 },
      { left: 200, top: 200, width: 50, height: 40 },
    ];
    const frame = { width: 500, height: 400 };

    const result = snapMove(moving, others, frame);
    expect(result.gaps).toEqual([]);
  });

  it('[R-FF-18] scenario 6: snapEdge snaps handle to sibling edge', () => {
    const others = [{ left: 200, top: 10, width: 80, height: 50 }];
    const frame = { width: 500, height: 400 };

    const result = snapEdge('x', 198, others, frame);
    expect(result).toEqual({
      value: 200,
      line: { axis: 'x', pos: 200, from: 10, to: 60 },
    });
  });
});

describe('FreeDragController smart guides [R-FF-18, R-FF-14]', () => {
  function setupTestElements() {
    document.body.innerHTML = `
      <section id="frame" data-rc-loc="src/Home.tsx:1:1" data-rc-free class="relative">
        <div id="c1" data-rc-loc="src/Home.tsx:2:3" class="absolute">C1</div>
        <div id="c2" data-rc-loc="src/Home.tsx:3:3" class="absolute">C2</div>
      </section>
      <main id="flow" data-rc-loc="src/Home.tsx:4:1"></main>
    `;
    const frame = document.getElementById('frame');
    const c1 = document.getElementById('c1');
    const c2 = document.getElementById('c2');
    const flow = document.getElementById('flow');
    if (!frame || !c1 || !c2 || !flow) throw new Error('Missing elements');

    const rects = new Map<Element, DropRect>([
      [frame, { x: 0, y: 0, width: 600, height: 400 }],
      [c1, { x: 40, y: 20, width: 50, height: 40 }],
      [c2, { x: 100, y: 80, width: 60, height: 40 }],
      [flow, { x: 0, y: 500, width: 600, height: 200 }],
    ]);
    const measure: Measure = (el) => rects.get(el) ?? { x: 0, y: 0, width: 0, height: 0 };
    return { frame, c1, c2, flow, rects, measure };
  }

  it('[R-FF-18] scenario 7: dragging element near sibling shows smart guides and clears on release', () => {
    const { c2, measure } = setupTestElements();
    const guidesHistory: { lines: readonly GuideLine[]; gaps: readonly GapMark[] }[] = [];
    const controller = new FreeDragController(
      {
        sendMove: () => {},
        sendResize: () => {},
        showLabel: () => {},
        showGuides: (lines, gaps) => {
          guidesHistory.push({ lines, gaps });
        },
      },
      window,
      measure,
    );

    // c2 starts at (100, 80). Drag with dx = -58, dy = 0 -> raw left = 42, near c1 left = 40 (diff 2 <= 4)
    expect(controller.tryBeginMove(c2, 100, 80, [c2])).toBe(true);
    window.dispatchEvent(pointer('pointermove', 100 - 58, 80));

    expect(c2.style.left).toBe('40px');
    const lastGuide = guidesHistory[guidesHistory.length - 1];
    expect(lastGuide?.lines).toEqual([{ axis: 'x', pos: 40, from: 20, to: 120 }]);

    // Release mouse
    window.dispatchEvent(pointer('pointerup', 100 - 58, 80));
    expect(guidesHistory[guidesHistory.length - 1]).toEqual({ lines: [], gaps: [] });
  });

  it('[R-FF-18] scenario 8: Esc mid-drag clears smart guides', () => {
    const { c2, measure } = setupTestElements();
    const guidesHistory: { lines: readonly GuideLine[]; gaps: readonly GapMark[] }[] = [];
    const controller = new FreeDragController(
      {
        sendMove: () => {},
        sendResize: () => {},
        showLabel: () => {},
        showGuides: (lines, gaps) => {
          guidesHistory.push({ lines, gaps });
        },
      },
      window,
      measure,
    );

    controller.tryBeginMove(c2, 100, 80, [c2]);
    window.dispatchEvent(pointer('pointermove', 100 - 58, 80));
    expect(guidesHistory.some((g) => g.lines.length > 0)).toBe(true);

    controller.cancel();
    expect(guidesHistory[guidesHistory.length - 1]).toEqual({ lines: [], gaps: [] });
  });

  it('[R-FF-18, R-FF-14] scenario 9: resizing east edge near sibling edge snaps without grid rounding', () => {
    const { c1, measure } = setupTestElements();
    const guidesHistory: { lines: readonly GuideLine[]; gaps: readonly GapMark[] }[] = [];
    const controller = new FreeDragController(
      {
        sendMove: () => {},
        sendResize: () => {},
        showLabel: () => {},
        showGuides: (lines, gaps) => {
          guidesHistory.push({ lines, gaps });
        },
      },
      window,
      measure,
    );

    // c1 is at left: 40, width: 50 -> right edge is 90. c2 has left: 100.
    // Resize 'e' with dx = 8 -> raw right edge is 98. Diff to 100 is 2 <= 4.
    // Snapped right edge = 100 -> new width = 100 - 40 = 60.
    // If it rounded to grid 8: 50 + 8 = 58 (not 60!).
    controller.beginResize(c1, 'e', 90, 40);
    window.dispatchEvent(pointer('pointermove', 90 + 8, 40));

    expect(c1.style.width).toBe('60px');
    const lastGuide = guidesHistory[guidesHistory.length - 1];
    expect(lastGuide?.lines).toEqual([{ axis: 'x', pos: 100, from: 80, to: 120 }]);
  });

  it('[R-FF-18, R-FF-14] scenario 10: resizing outside free frame shows no smart guides', () => {
    const { flow, measure } = setupTestElements();
    const guidesHistory: { lines: readonly GuideLine[]; gaps: readonly GapMark[] }[] = [];
    const controller = new FreeDragController(
      {
        sendMove: () => {},
        sendResize: () => {},
        showLabel: () => {},
        showGuides: (lines, gaps) => {
          guidesHistory.push({ lines, gaps });
        },
      },
      window,
      measure,
    );

    controller.beginResize(flow, 'se', 600, 700);
    window.dispatchEvent(pointer('pointermove', 600 + 10, 700 + 10));

    for (const g of guidesHistory) {
      expect(g.lines).toEqual([]);
    }
  });
});
