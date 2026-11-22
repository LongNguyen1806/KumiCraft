// @vitest-environment happy-dom
// Turning a free frame off gives back what turning it on replaced, except what was moved or edited
// since (spec-log #126).
import type { BatchEdit } from '@kumicraft/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  type CurrentElement,
  findFreeSnapshot,
  type FreeSnapshot,
  planFreeRestore,
  saveFreeSnapshot,
} from './free-frame-snapshot.ts';

const FRAME = 'src/pages/Login.tsx:10:5';
const LOGO = 'src/pages/Login.tsx:11:7';
const TEXT = 'src/pages/Login.tsx:12:7';

/** The login page's right block: a decoration placed by its author and a centred text block. */
const SNAPSHOT: FreeSnapshot = {
  loc: FRAME,
  frameBefore: 'flex flex-col items-center',
  frameAfter: 'flex flex-col items-center relative h-[898px]',
  children: [
    { loc: LOGO, before: 'absolute top-8 right-8 w-44', after: 'w-44 absolute left-150 top-8' },
    { loc: TEXT, before: 'relative z-10 max-w-xl', after: 'max-w-xl absolute left-40 top-90' },
  ],
};

const frame: CurrentElement = { loc: FRAME, tag: 'div', className: SNAPSHOT.frameAfter };
const el = (loc: string, className: string): CurrentElement => ({ loc, tag: 'div', className });

const classOf = (edits: readonly BatchEdit[], loc: string): string | undefined => {
  return writtenClass(edits.find((e) => e.kind === 'setClasses' && e.loc === loc));
};

describe('planFreeRestore [spec-log #126]', () => {
  it('nothing moved: every child and the frame get their classes back, flag off', () => {
    const plan = planFreeRestore(SNAPSHOT, frame, [
      el(LOGO, 'w-44 absolute left-150 top-8'),
      el(TEXT, 'max-w-xl absolute left-40 top-90'),
    ]);
    expect(plan.edits[0]).toEqual({
      kind: 'setFlag',
      loc: FRAME,
      tag: 'div',
      name: 'data-rc-free',
      on: false,
    });
    expect(classOf(plan.edits, FRAME)).toBe('flex flex-col items-center');
    expect(classOf(plan.edits, LOGO)).toBe('absolute top-8 right-8 w-44');
    expect(classOf(plan.edits, TEXT)).toBe('relative z-10 max-w-xl');
    expect({ restored: plan.restored, kept: plan.kept }).toEqual({ restored: 2, kept: 0 });
  });

  it('a moved child keeps its place, the frame stays its positioning parent, the rest come back', () => {
    const plan = planFreeRestore(SNAPSHOT, frame, [
      el(LOGO, 'w-44 absolute left-150 top-8'),
      el(TEXT, 'max-w-xl absolute left-52 top-60'),
    ]);
    expect(classOf(plan.edits, TEXT)).toBeUndefined();
    expect(classOf(plan.edits, LOGO)).toBe('absolute top-8 right-8 w-44');
    // The frame is not rewritten: `relative` and the height stay for the moved child.
    expect(classOf(plan.edits, FRAME)).toBeUndefined();
    expect({ restored: plan.restored, kept: plan.kept }).toEqual({ restored: 1, kept: 1 });
  });

  it('lines moved since (an edit above): children are matched by their classes', () => {
    const plan = planFreeRestore(SNAPSHOT, { ...frame, loc: 'src/pages/Login.tsx:14:5' }, [
      el('src/pages/Login.tsx:15:7', 'w-44 absolute left-150 top-8'),
      el('src/pages/Login.tsx:16:7', 'max-w-xl absolute left-40 top-90'),
    ]);
    expect(classOf(plan.edits, 'src/pages/Login.tsx:15:7')).toBe('absolute top-8 right-8 w-44');
    expect(classOf(plan.edits, 'src/pages/Login.tsx:16:7')).toBe('relative z-10 max-w-xl');
    expect(plan.restored).toBe(2);
  });

  it('a child edited by hand, or added after, is left as it is', () => {
    const plan = planFreeRestore(SNAPSHOT, frame, [
      el(LOGO, 'w-44 absolute left-150 top-8 opacity-50'),
      el(TEXT, 'max-w-xl absolute left-40 top-90'),
      el('src/pages/Login.tsx:13:7', 'p-2'),
    ]);
    expect(classOf(plan.edits, LOGO)).toBeUndefined();
    expect(classOf(plan.edits, 'src/pages/Login.tsx:13:7')).toBeUndefined();
    expect(classOf(plan.edits, TEXT)).toBe('relative z-10 max-w-xl');
    expect({ restored: plan.restored, kept: plan.kept }).toEqual({ restored: 1, kept: 2 });
  });

  it('a frame edited since, with nothing left placed: only the `relative` it got is dropped', () => {
    const plan = planFreeRestore(
      SNAPSHOT,
      { ...frame, className: 'flex flex-col items-center relative h-[898px] bg-black' },
      [el(LOGO, 'w-44 absolute left-150 top-8'), el(TEXT, 'max-w-xl absolute left-40 top-90')],
    );
    expect(classOf(plan.edits, FRAME)).toBe('flex flex-col items-center h-[898px] bg-black');
  });

  it('a frame that was `relative` before keeps it', () => {
    const before = { ...SNAPSHOT, frameBefore: 'relative flex' };
    const plan = planFreeRestore(before, { ...frame, className: 'relative flex bg-black' }, []);
    expect(classOf(plan.edits, FRAME)).toBeUndefined();
  });
});

describe('free frame records [spec-log #126]', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('finds the record by place, or by the frame classes when lines moved', () => {
    saveFreeSnapshot('p1', SNAPSHOT);
    expect(findFreeSnapshot('p1', FRAME, 'anything')).toEqual(SNAPSHOT);
    expect(findFreeSnapshot('p1', 'src/pages/Login.tsx:20:5', SNAPSHOT.frameAfter)).toEqual(
      SNAPSHOT,
    );
    // Another file, another project, or other classes: no record.
    expect(findFreeSnapshot('p1', 'src/pages/Home.tsx:20:5', SNAPSHOT.frameAfter)).toBeUndefined();
    expect(findFreeSnapshot('p2', FRAME, SNAPSHOT.frameAfter)).toBeUndefined();
    expect(findFreeSnapshot('p1', 'src/pages/Login.tsx:20:5', 'flex')).toBeUndefined();
  });

  it('turning the same frame on again replaces its record; only the last 30 are kept', () => {
    saveFreeSnapshot('p1', SNAPSHOT);
    saveFreeSnapshot('p1', { ...SNAPSHOT, frameBefore: 'grid' });
    expect(findFreeSnapshot('p1', FRAME, '')?.frameBefore).toBe('grid');

    for (let i = 0; i < 35; i += 1) {
      saveFreeSnapshot('p1', { ...SNAPSHOT, loc: `src/pages/P${String(i)}.tsx:1:1` });
    }
    expect(findFreeSnapshot('p1', FRAME, '')).toBeUndefined();
    expect(findFreeSnapshot('p1', 'src/pages/P34.tsx:1:1', '')).toBeDefined();
  });

  it('a damaged record is ignored instead of breaking the switch', () => {
    localStorage.setItem('kumicraft.freeFrameSnapshots.p1', '{not json');
    expect(findFreeSnapshot('p1', FRAME, '')).toBeUndefined();
    localStorage.setItem('kumicraft.freeFrameSnapshots.p1', JSON.stringify([{ loc: FRAME }]));
    expect(findFreeSnapshot('p1', FRAME, '')).toBeUndefined();
  });
});
import { writtenClass } from '../../api/written-class-test-support.ts';
