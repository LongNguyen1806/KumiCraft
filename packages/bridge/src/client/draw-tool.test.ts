// @vitest-environment happy-dom
import type { BridgeDrawEndPayload } from '@reactcraft/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { buildDrawEnd, DrawController, drawTarget, findDrawContainer } from './draw-tool.ts';
import type { DropRect } from './drop-target.ts';
import type { Measure } from './free-frame/free-geometry.ts';

function mapMeasure(rects: ReadonlyMap<Element, DropRect>): Measure {
  return (el) => rects.get(el) ?? { x: 0, y: 0, width: 0, height: 0 };
}

describe('draw-tool (R-DT-10..R-DT-12, R-DD-12)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.style.cursor = '';
  });

  it('Scenario 2: findDrawContainer skips leaf/text element and returns enclosing section [R-DT-11]', () => {
    document.body.innerHTML =
      '<section id="sec" data-rc-loc="src/App.tsx:2:2"><p id="para" data-rc-loc="src/App.tsx:5:4">Hello</p></section>';
    const section = document.getElementById('sec');
    const p = document.getElementById('para');
    expect(section).toBeDefined();
    expect(p).toBeDefined();
    if (!section || !p) return;

    document.elementsFromPoint = () => [p, section];
    const container = findDrawContainer(document, { x: 40, y: 40 });
    expect(container).toBe(section);
  });

  it('Scenario 3: drawTarget in normal container between children a and b [R-DT-11]', () => {
    document.body.innerHTML =
      '<section id="sec" data-rc-loc="src/App.tsx:2:2">' +
      '<div id="a" data-rc-loc="src/App.tsx:3:4"></div>' +
      '<div id="b" data-rc-loc="src/App.tsx:4:4"></div>' +
      '</section>';
    const section = document.getElementById('sec');
    const a = document.getElementById('a');
    const b = document.getElementById('b');
    if (!section || !a || !b) return;

    const rects = new Map<Element, DropRect>([
      [section, { x: 0, y: 0, width: 400, height: 200 }],
      [a, { x: 0, y: 20, width: 400, height: 40 }],
      [b, { x: 0, y: 80, width: 400, height: 40 }],
    ]);
    const target = drawTarget(section, { x: 50, y: 70 }, mapMeasure(rects));
    expect(target).toEqual({
      kind: 'sibling',
      ref: { loc: 'src/App.tsx:4:4', tag: 'div' },
      where: 'before',
    });
  });

  it('Scenario 4: drawTarget in normal container below all children [R-DT-11]', () => {
    document.body.innerHTML =
      '<section id="sec" data-rc-loc="src/App.tsx:2:2">' +
      '<div id="a" data-rc-loc="src/App.tsx:3:4"></div>' +
      '<div id="b" data-rc-loc="src/App.tsx:4:4"></div>' +
      '</section>';
    const section = document.getElementById('sec');
    const a = document.getElementById('a');
    const b = document.getElementById('b');
    if (!section || !a || !b) return;

    const rects = new Map<Element, DropRect>([
      [section, { x: 0, y: 0, width: 400, height: 200 }],
      [a, { x: 0, y: 20, width: 400, height: 40 }],
      [b, { x: 0, y: 80, width: 400, height: 40 }],
    ]);
    const target = drawTarget(section, { x: 50, y: 150 }, mapMeasure(rects));
    expect(target).toEqual({
      kind: 'child',
      parent: { loc: 'src/App.tsx:2:2', tag: 'section' },
      where: 'end',
    });
  });

  it('Scenario 5: drawTarget falls back to child end when nearest child is from another file [R-DD-12] [R-DT-11]', () => {
    document.body.innerHTML =
      '<main id="main" data-rc-loc="src/App.tsx:2:2">' +
      '<header id="hdr" data-rc-loc="src/components/Header.tsx:1:0"></header>' +
      '<div id="d" data-rc-loc="src/App.tsx:4:4"></div>' +
      '</main>';
    const main = document.getElementById('main');
    const hdr = document.getElementById('hdr');
    const d = document.getElementById('d');
    if (!main || !hdr || !d) return;

    const rects = new Map<Element, DropRect>([
      [main, { x: 0, y: 0, width: 400, height: 200 }],
      [hdr, { x: 0, y: 0, width: 400, height: 40 }],
      [d, { x: 0, y: 50, width: 400, height: 50 }],
    ]);
    const target = drawTarget(main, { x: 20, y: 10 }, mapMeasure(rects));
    expect(target).toEqual({
      kind: 'child',
      parent: { loc: 'src/App.tsx:2:2', tag: 'main' },
      where: 'end',
    });
  });

  it('Scenario 6: buildDrawEnd frame click (< 8px drag) in normal container [R-DT-11]', () => {
    document.body.innerHTML = '<section id="sec" data-rc-loc="src/App.tsx:2:2"></section>';
    const section = document.getElementById('sec');
    if (!section) return;

    const rects = new Map<Element, DropRect>([[section, { x: 0, y: 0, width: 400, height: 300 }]]);
    const payload = buildDrawEnd(
      'frame',
      section,
      { x: 50, y: 50 },
      { x: 53, y: 52 },
      8,
      mapMeasure(rects),
    );
    expect(payload.size).toBeUndefined();
    expect(payload.containerWidth).toBe(400);
    expect(payload.placement).toBeUndefined();
  });

  it('Scenario 7: buildDrawEnd frame reverse drag in free frame snaps top-left to grid 8 [R-DT-11]', () => {
    document.body.innerHTML =
      '<div id="free" data-rc-loc="src/App.tsx:2:2" data-rc-free="1"></div>';
    const free = document.getElementById('free');
    if (!free) return;

    const rects = new Map<Element, DropRect>([[free, { x: 100, y: 80, width: 500, height: 400 }]]);
    const payload = buildDrawEnd(
      'frame',
      free,
      { x: 263, y: 195 },
      { x: 143, y: 115 },
      8,
      mapMeasure(rects),
    );
    expect(payload.size).toEqual({ width: 120, height: 80 });
    expect(payload.placement).toEqual({
      kind: 'free',
      left: 40,
      top: 32,
      width: 120,
      height: 80,
    });
  });

  it('Scenario 8: buildDrawEnd text click in free frame snaps top-left to grid 8 without size [R-DT-12]', () => {
    document.body.innerHTML =
      '<div id="free" data-rc-loc="src/App.tsx:2:2" data-rc-free="1"></div>';
    const free = document.getElementById('free');
    if (!free) return;

    const rects = new Map<Element, DropRect>([[free, { x: 100, y: 80, width: 500, height: 400 }]]);
    const payload = buildDrawEnd(
      'text',
      free,
      { x: 143, y: 115 },
      { x: 200, y: 200 },
      8,
      mapMeasure(rects),
    );
    expect(payload.size).toBeUndefined();
    expect(payload.placement).toEqual({
      kind: 'free',
      left: 40,
      top: 32,
    });
  });

  it('Scenario 9: DrawController Escape cancels active drag without sending draw-end and keeps crosshair cursor [R-DT-10] [R-DT-11]', () => {
    document.body.innerHTML = '<section id="sec" data-rc-loc="src/App.tsx:2:2"></section>';
    const section = document.getElementById('sec');
    if (!section) return;

    document.elementsFromPoint = () => [section];
    const rects = new Map<Element, DropRect>([[section, { x: 0, y: 0, width: 400, height: 300 }]]);

    const drawnRects: (DropRect | undefined)[] = [];
    const sentPayloads: BridgeDrawEndPayload[] = [];
    const controller = new DrawController(
      {
        showDrawRect: (rect) => {
          drawnRects.push(rect);
        },
        sendDrawEnd: (p) => {
          sentPayloads.push(p);
        },
      },
      window,
      mapMeasure(rects),
      () => 8,
    );

    controller.setTool('frame');
    expect(document.documentElement.style.cursor).toBe('crosshair');

    expect(controller.begin(40, 40, document)).toBe(true);
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 160, clientY: 120 }));
    expect(drawnRects).toEqual([{ x: 40, y: 40, width: 120, height: 80 }]);

    expect(controller.escape()).toBe(true);
    expect(drawnRects).toEqual([{ x: 40, y: 40, width: 120, height: 80 }, undefined]);

    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 160, clientY: 120 }));
    expect(sentPayloads).toEqual([]);
    expect(document.documentElement.style.cursor).toBe('crosshair');

    controller.destroy();
  });
});
