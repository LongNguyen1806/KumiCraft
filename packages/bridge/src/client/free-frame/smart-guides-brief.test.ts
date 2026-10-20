// @vitest-environment happy-dom
// Locked cases from the round 12b brief (giao-viec/p2-luot12b-duong-giong.md section 4), hand-computed.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readGridTracks } from '../grid-cells.ts';
import { snapEdge, snapMove } from './smart-guides.ts';

const frame = { width: 600, height: 400 };
const A = { left: 40, top: 24, width: 200, height: 100 };
const B = { left: 400, top: 24, width: 100, height: 100 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('smart guides, brief table [R-FF-18]', () => {
  it('#1 left edge snaps to A; line spans A and the moving box', () => {
    const r = snapMove({ left: 43, top: 300, width: 50, height: 50 }, [A, B], frame);
    expect(r.left).toBe(40);
    expect(r.top).toBeUndefined();
    expect(r.lines).toEqual([{ axis: 'x', pos: 40, from: 24, to: 350 }]);
  });

  it('#2 centre snaps to the centre of A', () => {
    const r = snapMove({ left: 112, top: 300, width: 50, height: 50 }, [A, B], frame);
    expect(r.left).toBe(115);
    expect(r.lines.map((l) => [l.axis, l.pos])).toEqual([['x', 140]]);
  });

  it('#3 right edge to the frame edge, centre to the frame centre', () => {
    const r = snapMove({ left: 547, top: 177, width: 50, height: 50 }, [], frame);
    expect(r.left).toBe(550);
    expect(r.top).toBe(175);
    expect(r.lines).toContainEqual({ axis: 'x', pos: 600, from: 0, to: 400 });
    expect(r.lines.some((l) => l.axis === 'y' && l.pos === 200)).toBe(true);
  });

  it('#4 more than 4 px from every target: nothing', () => {
    const r = snapMove({ left: 320, top: 300, width: 50, height: 50 }, [A, B], frame);
    expect(r).toEqual({ lines: [], gaps: [] });
  });

  it('#5 unequal gaps do nothing; nearly equal gaps snap to equal spacing', () => {
    expect(snapMove({ left: 318, top: 40, width: 50, height: 50 }, [A, B], frame).gaps).toEqual([]);
    const r = snapMove({ left: 293, top: 40, width: 50, height: 50 }, [A, B], frame);
    expect(r.left).toBe(295);
    expect(r.gaps.map((g) => [g.axis, g.from, g.to])).toEqual([
      ['x', 240, 295],
      ['x', 345, 400],
    ]);
  });

  it('#6 an edge being resized snaps to A within 4 px only', () => {
    expect(snapEdge('x', 238, [A], frame).value).toBe(240);
    expect(snapEdge('x', 238, [A], frame).line?.pos).toBe(240);
    expect(snapEdge('x', 320, [A], frame).value).toBeUndefined();
  });
});

describe('readGridTracks, brief table [R-DD-13]', () => {
  function styleOf(display: string, columns: string, rows: string): CSSStyleDeclaration {
    const style = document.createElement('div').style;
    style.display = display;
    style.setProperty('grid-template-columns', columns);
    style.setProperty('grid-template-rows', rows);
    return style;
  }

  it('#12 resolved px tracks are read; "none" columns give undefined', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue(styleOf('grid', '200px 200px', '80px'));
    expect(readGridTracks(el)).toMatchObject({ columns: [200, 200], rows: [80] });
    vi.spyOn(window, 'getComputedStyle').mockReturnValue(styleOf('grid', 'none', '80px'));
    expect(readGridTracks(el)).toBeUndefined();
    el.remove();
  });
});
