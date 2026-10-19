// @vitest-environment happy-dom
// Unit tests for drop-target calculation (SPEC-04 M-DD, R-DD-11, R-DD-12, R-DD-15).
import { describe, expect, it } from 'vitest';

import {
  canContain,
  type DropCache,
  type DropEnv,
  type DropRect,
  findDropTarget,
  type LayoutAxis,
  layoutAxisOf,
} from './drop-target.ts';

function createFakeEnv(
  rects: ReadonlyMap<Element, DropRect>,
  axes: ReadonlyMap<Element, LayoutAxis>,
  hitTester: (x: number, y: number) => readonly Element[],
  onMeasure?: (el: Element) => void,
): DropEnv {
  return {
    hitTest: hitTester,
    measure: (el) => {
      onMeasure?.(el);
      return rects.get(el) ?? { x: 0, y: 0, width: 0, height: 0 };
    },
    axisOf: (el) => axes.get(el) ?? 'column',
  };
}

function elById(id: string): Element {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

describe('drop-target [R-DD-11, R-DD-12, R-DD-15]', () => {
  it('scenario 1: layoutAxisOf detects axis from inline styles [R-DD-11]', () => {
    const cases: readonly { style: string; expected: LayoutAxis }[] = [
      { style: 'display:block', expected: 'column' },
      { style: 'display:flex', expected: 'row' },
      { style: 'display:flex; flex-direction:column', expected: 'column' },
      { style: 'display:flex; flex-wrap:wrap', expected: 'wrap' },
      { style: 'display:grid', expected: 'grid' },
    ];

    for (const c of cases) {
      const el = document.createElement('div');
      el.setAttribute('style', c.style);
      document.body.appendChild(el);
      expect(layoutAxisOf(el)).toBe(c.expected);
      el.remove();
    }
  });

  it('scenario 2: canContain checks void tags and direct text children [R-DD-11]', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = [
      '<img id="c1" />',
      '<p id="c2">chữ</p>',
      '<div id="c3"> <span></span> </div>',
      '<div id="c4"></div>',
      '<div id="c5"><!--c--><a></a></div>',
    ].join('');

    const c1 = wrap.querySelector('#c1');
    const c2 = wrap.querySelector('#c2');
    const c3 = wrap.querySelector('#c3');
    const c4 = wrap.querySelector('#c4');
    const c5 = wrap.querySelector('#c5');
    if (!c1 || !c2 || !c3 || !c4 || !c5) throw new Error('Missing test elements');

    expect(canContain(c1)).toBe(false);
    expect(canContain(c2)).toBe(false);
    expect(canContain(c3)).toBe(true);
    expect(canContain(c4)).toBe(true);
    expect(canContain(c5)).toBe(true);
  });

  it('scenario 3: column parent with 3 empty div children hit near left edge x=5 [R-DD-11]', () => {
    document.body.innerHTML = `
      <section id="parent" data-rc-loc="src/Home.tsx:1:1">
        <div id="d1" data-rc-loc="src/Home.tsx:2:3"></div>
        <div id="d2" data-rc-loc="src/Home.tsx:3:3"></div>
        <div id="d3" data-rc-loc="src/Home.tsx:4:3"></div>
      </section>
    `;
    const parent = elById('parent');
    const d1 = elById('d1');
    const d2 = elById('d2');
    const d3 = elById('d3');

    const rects = new Map<Element, DropRect>([
      [parent, { x: 0, y: 0, width: 400, height: 300 }],
      [d1, { x: 0, y: 0, width: 400, height: 100 }],
      [d2, { x: 0, y: 100, width: 400, height: 100 }],
      [d3, { x: 0, y: 200, width: 400, height: 100 }],
    ]);
    const axes = new Map<Element, LayoutAxis>([[parent, 'column']]);
    const env = createFakeEnv(rects, axes, (_x, y) => {
      if (y < 100) return [d1, parent];
      if (y < 200) return [d2, parent];
      return [d3, parent];
    });
    const cache: DropCache = {};

    const r1 = findDropTarget(5, 120, [], env, cache);
    expect(r1?.target).toEqual({
      kind: 'sibling',
      ref: { loc: 'src/Home.tsx:3:3', tag: 'div' },
      where: 'before',
    });

    const r2 = findDropTarget(5, 180, [], env, cache);
    expect(r2?.target).toEqual({
      kind: 'sibling',
      ref: { loc: 'src/Home.tsx:3:3', tag: 'div' },
      where: 'after',
    });

    const r3 = findDropTarget(5, 290, [], env, cache);
    expect(r3?.target).toEqual({
      kind: 'sibling',
      ref: { loc: 'src/Home.tsx:4:3', tag: 'div' },
      where: 'after',
    });
  });

  it('scenario 4: row parent with 3 children when hitTest returns parent at (190, 50) [R-DD-11]', () => {
    document.body.innerHTML = `
      <header id="row" data-rc-loc="src/Home.tsx:1:1">
        <div id="c1" data-rc-loc="src/Home.tsx:2:3"></div>
        <div id="c2" data-rc-loc="src/Home.tsx:3:3"></div>
        <div id="c3" data-rc-loc="src/Home.tsx:4:3"></div>
      </header>
    `;
    const row = elById('row');
    const c1 = elById('c1');
    const c2 = elById('c2');
    const c3 = elById('c3');

    const rects = new Map<Element, DropRect>([
      [row, { x: 0, y: 0, width: 400, height: 100 }],
      [c1, { x: 0, y: 0, width: 80, height: 100 }],
      [c2, { x: 100, y: 0, width: 80, height: 100 }],
      [c3, { x: 200, y: 0, width: 80, height: 100 }],
    ]);
    const axes = new Map<Element, LayoutAxis>([[row, 'row']]);
    const env = createFakeEnv(rects, axes, () => [row]);

    const res = findDropTarget(190, 50, [], env, {});
    expect(res?.target).toEqual({
      kind: 'sibling',
      ref: { loc: 'src/Home.tsx:4:3', tag: 'div' },
      where: 'before',
    });
    expect(res?.label).toBe('header');
  });

  it('scenario 5: 3-column grid and wrap with 6 <p> children at (120, 150) [R-DD-11]', () => {
    document.body.innerHTML = `
      <div id="grid" data-rc-loc="src/Home.tsx:1:1">
        <p id="p1" data-rc-loc="src/Home.tsx:2:3">chữ</p>
        <p id="p2" data-rc-loc="src/Home.tsx:3:3">chữ</p>
        <p id="p3" data-rc-loc="src/Home.tsx:4:3">chữ</p>
        <p id="p4" data-rc-loc="src/Home.tsx:5:3">chữ</p>
        <p id="p5" data-rc-loc="src/Home.tsx:6:3">chữ</p>
        <p id="p6" data-rc-loc="src/Home.tsx:7:3">chữ</p>
      </div>
    `;
    const grid = elById('grid');
    const children = [1, 2, 3, 4, 5, 6].map((n) => elById(`p${String(n)}`));

    const rects = new Map<Element, DropRect>([[grid, { x: 0, y: 0, width: 300, height: 200 }]]);
    children.forEach((el, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      rects.set(el, { x: col * 100, y: row * 100, width: 100, height: 100 });
    });

    for (const axis of ['grid', 'wrap'] as const) {
      const axes = new Map<Element, LayoutAxis>([[grid, axis]]);
      const env = createFakeEnv(rects, axes, () => [grid]);
      const res = findDropTarget(120, 150, [], env, {});
      expect(res?.target).toEqual({
        kind: 'sibling',
        ref: { loc: 'src/Home.tsx:6:3', tag: 'p' },
        where: 'before',
      });
    }
  });

  it('scenario 6: pointing into the center of an empty <section> drops inside [R-DD-11]', () => {
    document.body.innerHTML = '<section id="sec" data-rc-loc="src/Home.tsx:1:1"></section>';
    const sec = elById('sec');
    const rects = new Map<Element, DropRect>([[sec, { x: 0, y: 0, width: 300, height: 200 }]]);
    const axes = new Map<Element, LayoutAxis>([[sec, 'column']]);
    const env = createFakeEnv(rects, axes, () => [sec]);

    const res = findDropTarget(150, 100, [], env, {});
    expect(res).toEqual({
      target: {
        kind: 'child',
        parent: { loc: 'src/Home.tsx:1:1', tag: 'section' },
        where: 'end',
      },
      rect: { x: 0, y: 0, width: 300, height: 200 },
      indicator: 'box',
      label: 'section',
      container: sec,
    });
  });

  it('scenario 7: pointing at upper half of <p> inside column <div> drops before <p> [R-DD-11]', () => {
    document.body.innerHTML = `
      <div id="col" data-rc-loc="src/Home.tsx:1:1">
        <p id="p" data-rc-loc="src/Home.tsx:2:3">Hello</p>
      </div>
    `;
    const col = elById('col');
    const p = elById('p');
    const rects = new Map<Element, DropRect>([
      [col, { x: 0, y: 0, width: 300, height: 200 }],
      [p, { x: 0, y: 20, width: 300, height: 60 }],
    ]);
    const axes = new Map<Element, LayoutAxis>([[col, 'column']]);
    const env = createFakeEnv(rects, axes, () => [p, col]);

    const res = findDropTarget(100, 35, [], env, {});
    expect(res?.target).toEqual({
      kind: 'sibling',
      ref: { loc: 'src/Home.tsx:2:3', tag: 'p' },
      where: 'before',
    });
    expect(res?.label).toBe('div');
  });

  it('scenario 8: climbs component boundary when Card and grid are in different files [R-DD-12]', () => {
    document.body.innerHTML = `
      <section id="sec" data-rc-loc="src/Home.tsx:4:5">
        <div id="grid" data-rc-loc="src/Home.tsx:5:7">
          <div id="card1" data-rc-loc="src/Card.tsx:3:5">Card 1</div>
          <div id="card2" data-rc-loc="src/Card.tsx:3:5">Card 2</div>
        </div>
      </section>
    `;
    const sec = elById('sec');
    const grid = elById('grid');
    const card1 = elById('card1');
    const card2 = elById('card2');

    // Grid is y: 0..100 (center y = 50 on section's column axis).
    // Card 2 is x: 100..200 (center x = 150 on grid's row axis).
    // Pointer at (120, 30): left half of Card 2 (120 < 150) and upper half of grid (30 < 50).
    const rects = new Map<Element, DropRect>([
      [sec, { x: 0, y: 0, width: 400, height: 300 }],
      [grid, { x: 0, y: 0, width: 400, height: 100 }],
      [card1, { x: 0, y: 0, width: 100, height: 100 }],
      [card2, { x: 100, y: 0, width: 100, height: 100 }],
    ]);
    const axes = new Map<Element, LayoutAxis>([
      [sec, 'column'],
      [grid, 'row'],
    ]);
    const env = createFakeEnv(rects, axes, () => [card2, grid, sec]);

    const res = findDropTarget(120, 30, [], env, {});
    expect(res?.target).toEqual({
      kind: 'sibling',
      ref: { loc: 'src/Home.tsx:5:7', tag: 'div' },
      where: 'before',
    });
    expect(res?.label).toBe('section');
  });

  it('scenario 9: dragging div#a and pointing at #a or its descendant returns undefined [R-DD-11]', () => {
    document.body.innerHTML = `
      <main id="main" data-rc-loc="src/Home.tsx:1:1">
        <div id="a" data-rc-loc="src/Home.tsx:2:3">
          <span id="child" data-rc-loc="src/Home.tsx:3:5">Text</span>
        </div>
      </main>
    `;
    const main = elById('main');
    const a = elById('a');
    const child = elById('child');
    const rects = new Map<Element, DropRect>([
      [main, { x: 0, y: 0, width: 400, height: 400 }],
      [a, { x: 0, y: 0, width: 200, height: 200 }],
      [child, { x: 10, y: 10, width: 50, height: 20 }],
    ]);
    const axes = new Map<Element, LayoutAxis>([[main, 'column']]);

    const envOnA = createFakeEnv(rects, axes, () => [a, main]);
    expect(findDropTarget(50, 50, [a], envOnA, {})).toBeUndefined();

    const envOnChild = createFakeEnv(rects, axes, () => [child, a, main]);
    expect(findDropTarget(20, 15, [a], envOnChild, {})).toBeUndefined();
  });

  it('scenario 10: caches child measurements for the same parent and re-measures on parent change or cache clear [R-DD-15]', () => {
    document.body.innerHTML = `
      <div id="p1" data-rc-loc="src/Home.tsx:1:1">
        <div id="c1" data-rc-loc="src/Home.tsx:2:3"></div>
        <div id="c2" data-rc-loc="src/Home.tsx:3:3"></div>
      </div>
      <div id="p2" data-rc-loc="src/Home.tsx:5:1">
        <div id="c3" data-rc-loc="src/Home.tsx:6:3"></div>
      </div>
    `;
    const p1 = elById('p1');
    const c1 = elById('c1');
    const c2 = elById('c2');
    const p2 = elById('p2');
    const c3 = elById('c3');

    const rects = new Map<Element, DropRect>([
      [p1, { x: 0, y: 0, width: 300, height: 200 }],
      [c1, { x: 0, y: 0, width: 300, height: 80 }],
      [c2, { x: 0, y: 100, width: 300, height: 80 }],
      [p2, { x: 0, y: 220, width: 300, height: 200 }],
      [c3, { x: 0, y: 220, width: 300, height: 80 }],
    ]);
    const axes = new Map<Element, LayoutAxis>([
      [p1, 'column'],
      [p2, 'column'],
    ]);

    const measuredChildren: Element[] = [];
    let currentHit: Element = p1;
    const env = createFakeEnv(
      rects,
      axes,
      () => [currentHit],
      (el) => {
        if (el === c1 || el === c2 || el === c3) {
          measuredChildren.push(el);
        }
      },
    );

    const cache: DropCache = {};
    findDropTarget(150, 30, [], env, cache);
    expect(measuredChildren).toEqual([c1, c2]);

    // 2nd call with same parent p1 -> does not re-measure children
    measuredChildren.length = 0;
    findDropTarget(150, 150, [], env, cache);
    expect(measuredChildren).toEqual([]);

    // Switch parent to p2 -> measures c3
    currentHit = p2;
    findDropTarget(150, 260, [], env, cache);
    expect(measuredChildren).toEqual([c3]);

    // Clear cache -> re-measures c3
    measuredChildren.length = 0;
    delete cache.parent;
    findDropTarget(150, 260, [], env, cache);
    expect(measuredChildren).toEqual([c3]);
  });
});
