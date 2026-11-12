// @vitest-environment happy-dom
// The snap reach follows the Canvas zoom, Alt or the Studio switch turns snapping off, and a snap
// shows square markers (spec-log #125).
import type { BridgeFreeMovePayload } from '@kumicraft/shared';
import { afterEach, describe, expect, it } from 'vitest';

import type { DropRect } from '../drop-target.ts';
import { FreeDragController } from './free-drag.ts';
import type { Measure } from './free-geometry.ts';
import { FreeOverlay } from './free-overlay.ts';
import { snapMove, snapThreshold } from './smart-guides.ts';

function elById(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

/** A 600 × 400 frame at the origin with A at (40, 40) and B at (300, 200), both 100 × 50. */
function setup() {
  document.body.innerHTML = `
    <section id="frame" data-rc-loc="src/App.tsx:3:5" data-rc-free class="relative">
      <div id="a" data-rc-loc="src/App.tsx:4:7" class="absolute">A</div>
      <div id="b" data-rc-loc="src/App.tsx:5:7" class="absolute">B</div>
    </section>
  `;
  const a = elById('a');
  const rects = new Map<Element, DropRect>([
    [elById('frame'), { x: 0, y: 0, width: 600, height: 400 }],
    [a, { x: 40, y: 40, width: 100, height: 50 }],
    [elById('b'), { x: 300, y: 200, width: 100, height: 50 }],
  ]);
  const measure: Measure = (el) => rects.get(el) ?? { x: 0, y: 0, width: 0, height: 0 };
  const moves: BridgeFreeMovePayload[] = [];
  const controller = new FreeDragController(
    {
      sendMove: (p) => moves.push(p),
      sendResize: () => undefined,
      showLabel: () => undefined,
      showGuides: () => undefined,
    },
    window,
    measure,
  );
  return { a, controller, moves };
}

/** Drags A right by 248 px: its left edge lands at 288, 12 px short of B's left edge (300). */
function dragA(controller: FreeDragController, a: HTMLElement, altKey = false): void {
  controller.tryBeginMove(a, 50, 50, [a]);
  window.dispatchEvent(
    new PointerEvent('pointermove', { clientX: 298, clientY: 50, altKey, bubbles: true }),
  );
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: 298, clientY: 50, bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('snap reach follows the Canvas zoom [spec-log #125]', () => {
  it('snapThreshold is 8 screen pixels in page pixels', () => {
    expect(snapThreshold(1)).toBe(8);
    expect(snapThreshold(0.5)).toBe(16);
    expect(snapThreshold(2)).toBe(4);
    expect(snapThreshold(0)).toBe(4);
  });

  it('snapMove catches an edge 12 px away only with a reach of 12 or more', () => {
    const moving = { left: 288, top: 40, width: 100, height: 50 };
    const others = [{ left: 300, top: 200, width: 100, height: 50 }];
    const frame = { width: 600, height: 400 };
    expect(snapMove(moving, others, frame).left).toBeUndefined();
    expect(snapMove(moving, others, frame, 16).left).toBe(300);
  });

  it('at 50 % zoom a drag 12 page px (6 screen px) from an edge snaps onto it', () => {
    const { a, controller, moves } = setup();
    controller.setSnap(true, 0.5);
    dragA(controller, a);
    expect(moves.at(-1)?.items[0]?.left).toBe(300);
  });

  it('at 100 % zoom the same drag (12 screen px away) stays on the grid', () => {
    const { a, controller, moves } = setup();
    controller.setSnap(true, 1);
    dragA(controller, a);
    expect(moves.at(-1)?.items[0]?.left).toBe(288);
  });

  it('holding Alt or turning snap off places the element freely, on the grid only', () => {
    const held = setup();
    held.controller.setSnap(true, 0.5);
    dragA(held.controller, held.a, true);
    expect(held.moves.at(-1)?.items[0]?.left).toBe(288);

    const off = setup();
    off.controller.setSnap(false, 0.5);
    dragA(off.controller, off.a);
    expect(off.moves.at(-1)?.items[0]?.left).toBe(288);
  });
});

describe('snap markers [spec-log #125]', () => {
  it('draws a square at each end of a guide, the same size on screen at any zoom', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });
    const overlay = new FreeOverlay(root);
    overlay.setScale(0.5);
    overlay.setGuides([{ axis: 'x', pos: 300, from: 40, to: 250 }], [], { x: 10, y: 20 });
    overlay.render(document);

    const marks = [...root.querySelectorAll<HTMLElement>('.snap-mark')];
    expect(marks).toHaveLength(2);
    expect(marks.map((m) => [m.style.left, m.style.top, m.style.width])).toEqual([
      ['303px', '53px', '14px'],
      ['303px', '263px', '14px'],
    ]);

    overlay.setGuides([], []);
    overlay.render(document);
    expect(root.querySelectorAll('.snap-mark')).toHaveLength(0);
  });
});
