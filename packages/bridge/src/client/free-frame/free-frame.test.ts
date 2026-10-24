// @vitest-environment happy-dom
// Unit tests for the Bridge side of free frames (SPEC-04 section 18E, R-FF-10..14).
import type {
  BridgeDropTargetPayload,
  BridgeFreeMovePayload,
  BridgeFreeResizePayload,
  BridgeMoveIntentPayload,
} from '@kumicraft/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DragController } from '../drag.ts';
import type { DropEnv, DropRect } from '../drop-target.ts';
import { FreeDragController } from './free-drag.ts';
import {
  directLocChildren,
  freeDropPlacement,
  hasHeightClass,
  type Measure,
  measureFreeFrame,
} from './free-geometry.ts';
import { resizeBox, resizeChanges } from './resize-box.ts';

function elById(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

/** A frame at (100, 50) holding a card at (+40, +24) and a title at (+0, +120) in the viewport. */
function setupFrame(): {
  frame: HTMLElement;
  card: HTMLElement;
  title: HTMLElement;
  rects: Map<Element, DropRect>;
} {
  document.body.innerHTML = `
    <section id="frame" data-rc-loc="src/pages/Home.tsx:3:5" data-rc-free class="relative p-4">
      <div id="card" data-rc-loc="src/pages/Home.tsx:4:7" class="absolute left-10 top-6">Card</div>
      <span><h2 id="title" data-rc-loc="src/pages/Home.tsx:5:7">Title</h2></span>
    </section>
    <main id="flow" data-rc-loc="src/pages/Home.tsx:8:5"></main>
  `;
  const frame = elById('frame');
  const card = elById('card');
  const title = elById('title');
  const rects = new Map<Element, DropRect>([
    [frame, { x: 100, y: 50, width: 600, height: 400 }],
    [card, { x: 140, y: 74, width: 200, height: 100 }],
    [title, { x: 100, y: 170, width: 300, height: 30 }],
    [elById('flow'), { x: 100, y: 500, width: 600, height: 200 }],
  ]);
  return { frame, card, title, rects };
}

const measureFrom =
  (rects: Map<Element, DropRect>): Measure =>
  (el) =>
    rects.get(el) ?? { x: 0, y: 0, width: 0, height: 0 };

function pointer(type: string, x: number, y: number, shiftKey = false): PointerEvent {
  return new PointerEvent(type, { clientX: x, clientY: y, shiftKey, bubbles: true });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('free-geometry [R-FF-10, R-FF-12]', () => {
  it('measures each direct child relative to the frame, through wrapper nodes', () => {
    const { frame, rects } = setupFrame();
    expect(directLocChildren(frame).map((el) => el.id)).toEqual(['card', 'title']);
    expect(measureFreeFrame(frame, document, measureFrom(rects))).toEqual({
      ref: { loc: 'src/pages/Home.tsx:3:5', index: 0 },
      width: 600,
      height: 400,
      hasHeight: false,
      children: [
        {
          ref: { loc: 'src/pages/Home.tsx:4:7', index: 0 },
          tag: 'div',
          left: 40,
          top: 24,
          width: 200,
          height: 100,
        },
        {
          ref: { loc: 'src/pages/Home.tsx:5:7', index: 0 },
          tag: 'h2',
          left: 0,
          top: 120,
          width: 300,
          height: 30,
        },
      ],
    });
  });

  it('hasHeightClass sees unprefixed h-/min-h- only', () => {
    const el = document.createElement('div');
    el.className = 'p-4 md:h-40';
    expect(hasHeightClass(el)).toBe(false);
    el.className = 'p-4 min-h-[300px]';
    expect(hasHeightClass(el)).toBe(true);
    el.className = 'h-96';
    expect(hasHeightClass(el)).toBe(true);
  });

  it('free drop keeps the grab offset and snaps to the grid', () => {
    const { frame, rects } = setupFrame();
    const placement = freeDropPlacement(
      frame,
      { x: 100 + 133, y: 50 + 77 },
      { x: 10, y: 5 },
      8,
      measureFrom(rects),
    );
    expect(placement).toEqual({ kind: 'free', left: 120, top: 72 });
  });
});

describe('resize-box [R-FF-14]', () => {
  const start = { left: 40, top: 24, width: 200, height: 100 };

  it('east edge snaps the right side; west edge moves left and keeps the right side', () => {
    expect(resizeBox(start, 'e', { dx: 21, dy: 50 }, 8)).toEqual({ ...start, width: 224 });
    expect(resizeBox(start, 'w', { dx: -18, dy: 0 }, 8)).toEqual({
      left: 24,
      top: 24,
      width: 216,
      height: 100,
    });
  });

  it('never shrinks below one grid cell; Shift on a corner keeps the ratio', () => {
    expect(resizeBox(start, 's', { dx: 0, dy: -500 }, 16).height).toBe(16);
    const sized = resizeBox(start, 'se', { dx: 200, dy: 0 }, 8, true);
    expect(sized.width / sized.height).toBeCloseTo(2, 1);
  });

  it('resizeChanges lists only changed fields; left/top only in a free frame', () => {
    const end = { left: 24, top: 24, width: 216, height: 100 };
    expect(resizeChanges(start, end, true)).toEqual({ left: 24, width: 216 });
    expect(resizeChanges(start, end, false)).toEqual({ width: 216 });
  });
});

describe('DragController with free frames [R-FF-12]', () => {
  function controllerFor(rects: Map<Element, DropRect>, hit: (y: number) => Element[]) {
    const env: DropEnv = {
      hitTest: (_x, y) => hit(y),
      measure: measureFrom(rects),
      axisOf: () => 'column',
    };
    const dropTargets: BridgeDropTargetPayload[] = [];
    const intents: BridgeMoveIntentPayload[] = [];
    const controller = new DragController(
      env,
      {
        sendDropTarget: (p) => dropTargets.push(p),
        sendMoveIntent: (p) => intents.push(p),
        showIndicator: () => undefined,
        showGridCells: () => undefined,
      },
      window,
      () => 16,
    );
    return { controller, dropTargets, intents };
  }

  it('a Studio drag over a free frame targets the frame end with a snapped free placement', () => {
    const { frame, card, rects } = setupFrame();
    const { controller, dropTargets } = controllerFor(rects, () => [card, frame]);
    controller.studioDragOver({ source: 'library', x: 100 + 70, y: 50 + 90 });
    expect(dropTargets.at(-1)).toEqual({
      target: {
        kind: 'child',
        parent: { loc: 'src/pages/Home.tsx:3:5', tag: 'section' },
        where: 'end',
      },
      rect: { x: 100, y: 50, width: 600, height: 400 },
      label: 'section',
      placement: { kind: 'free', left: 64, top: 96 },
    });
  });

  it('dragging a free child out to a normal container sends move-intent with flow placement', () => {
    vi.useFakeTimers();
    const { card, rects } = setupFrame();
    const flow = elById('flow');
    const { controller, intents } = controllerFor(rects, (y) => (y > 500 ? [flow] : [card]));
    controller.beginCanvasDrag([card], 150, 80);
    window.dispatchEvent(pointer('pointermove', 300, 600));
    vi.runAllTimers();
    window.dispatchEvent(pointer('pointerup', 300, 600));
    expect(intents).toEqual([
      {
        elements: [{ loc: 'src/pages/Home.tsx:4:7', tag: 'div' }],
        target: {
          kind: 'child',
          parent: { loc: 'src/pages/Home.tsx:8:5', tag: 'main' },
          where: 'end',
        },
        placement: { kind: 'flow' },
      },
    ]);
  });
});

describe('FreeDragController [R-FF-13, R-FF-14]', () => {
  function setupController() {
    const setup = setupFrame();
    const moves: BridgeFreeMovePayload[] = [];
    const resizes: BridgeFreeResizePayload[] = [];
    const labels: (string | undefined)[] = [];
    const controller = new FreeDragController(
      {
        sendMove: (p) => moves.push(p),
        sendResize: (p) => resizes.push(p),
        showLabel: (text) => labels.push(text),
        showGuides: () => undefined,
      },
      window,
      measureFrom(setup.rects),
    );
    return { ...setup, controller, moves, resizes, labels };
  }

  it('a press outside a free frame or on an unselected element starts nothing', () => {
    const { controller, card } = setupController();
    expect(controller.tryBeginMove(card, 150, 80, [])).toBe(false);
    expect(controller.tryBeginMove(elById('flow'), 150, 600, [elById('flow')])).toBe(false);
  });

  it('dragging a selected child previews snapped coordinates and writes once on release', () => {
    const { controller, card, moves, labels } = setupController();
    expect(controller.tryBeginMove(card, 150, 80, [card])).toBe(true);
    window.dispatchEvent(pointer('pointermove', 150 + 30, 80 + 13));
    expect(card.style.left).toBe('72px');
    expect(card.style.top).toBe('40px');
    expect(labels.at(-1)).toBe('x 72 · y 40');
    window.dispatchEvent(pointer('pointerup', 180, 93));
    expect(moves).toEqual([
      {
        items: [
          { ref: { loc: 'src/pages/Home.tsx:4:7', index: 0 }, tag: 'div', left: 72, top: 40 },
        ],
      },
    ]);
    expect(controller.consumeClickSuppression()).toBe(true);
  });

  it('Esc mid-drag puts the element back and writes nothing', () => {
    const { controller, card, moves } = setupController();
    card.style.left = '3px';
    controller.tryBeginMove(card, 150, 80, [card]);
    window.dispatchEvent(pointer('pointermove', 220, 140));
    controller.cancel();
    window.dispatchEvent(pointer('pointerup', 220, 140));
    expect(card.style.left).toBe('3px');
    expect(card.style.top).toBe('');
    expect(moves).toEqual([]);
  });

  it('the kept preview is removed once the new classes land', async () => {
    const { controller, card } = setupController();
    controller.tryBeginMove(card, 150, 80, [card]);
    window.dispatchEvent(pointer('pointermove', 180, 93));
    window.dispatchEvent(pointer('pointerup', 180, 93));
    expect(card.style.left).toBe('72px');
    card.className = 'absolute left-18 top-10';
    await Promise.resolve();
    expect(card.style.left).toBe('');
  });

  it('resizing from the left edge sends left and width; double-click sends resetSize', () => {
    const { controller, card, resizes, labels } = setupController();
    controller.beginResize(card, 'w', 140, 120);
    window.dispatchEvent(pointer('pointermove', 140 - 18, 120));
    expect(labels.at(-1)).toBe('216 × 100');
    window.dispatchEvent(pointer('pointerup', 122, 120));
    controller.resetSize(card);
    expect(resizes).toEqual([
      { ref: { loc: 'src/pages/Home.tsx:4:7', index: 0 }, tag: 'div', left: 24, width: 216 },
      { ref: { loc: 'src/pages/Home.tsx:4:7', index: 0 }, tag: 'div', resetSize: true },
    ]);
  });

  it('outside a free frame only the size is sent', () => {
    const { controller, resizes, rects } = setupController();
    const flow = elById('flow');
    rects.set(flow, { x: 100, y: 500, width: 600, height: 200 });
    controller.beginResize(flow, 'se', 700, 700);
    window.dispatchEvent(pointer('pointermove', 700 - 100, 700 + 40));
    window.dispatchEvent(pointer('pointerup', 600, 740));
    expect(resizes).toEqual([
      { ref: { loc: 'src/pages/Home.tsx:8:5', index: 0 }, tag: 'main', width: 504, height: 240 },
    ]);
  });
});
