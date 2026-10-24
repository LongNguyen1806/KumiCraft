// Studio-side tests for turning a free frame on and for duplicate/paste placement (R-FF-10, R-FF-12).
import type {
  AttributeLevelEdit,
  BridgeFreeMeasurePayload,
  ElementSource,
} from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { executeEnableFreeFrame } from './free-frame-ops.ts';
import { freeStackPlacement } from './free-frame-placement.ts';

const FRAME = 'src/pages/Home.tsx:3:5';

function source(loc: string, className: ElementSource['className'], free = false): ElementSource {
  return {
    loc,
    tag: 'div',
    fileHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    className,
    text: { kind: 'none' },
    attributes: {},
    inLoop: false,
    free,
  };
}

function measure(children: readonly [string, number, number][]): BridgeFreeMeasurePayload {
  return {
    ref: { loc: FRAME, index: 0 },
    width: 640,
    height: 300.4,
    hasHeight: false,
    children: children.map(([loc, left, top]) => ({
      ref: { loc, index: 0 },
      tag: 'div',
      left,
      top,
      width: 120,
      height: 80,
    })),
  };
}

function mockSources(byLoc: Readonly<Record<string, ElementSource['className'] | 'missing'>>) {
  vi.spyOn(sourceClient, 'fetchElementSourceByLoc').mockImplementation((loc) => {
    const cls = byLoc[loc];
    return Promise.resolve(cls === undefined || cls === 'missing' ? undefined : source(loc, cls));
  });
}

function batchEdits(spy: { mock: { calls: { edits: AttributeLevelEdit[] }[][] } }) {
  return spy.mock.calls[0]?.[0]?.edits ?? [];
}

describe('Free frame on: Studio batch [R-FF-10]', () => {
  beforeEach(() => {
    useSelectionStore.getState().reset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Scenario 9: one batch with flag, frame class and 3 snapped children', async () => {
    const batchSpy = vi
      .spyOn(sourceClient, 'editSourceBatch')
      .mockResolvedValue({ changed: true, files: ['src/pages/Home.tsx'] });
    mockSources({
      'src/pages/Home.tsx:4:7': { kind: 'static', value: 'p-4' },
      'src/pages/Home.tsx:5:7': { kind: 'none' },
      'src/pages/Home.tsx:6:7': { kind: 'static', value: 'relative z-10 w-40' },
    });

    const error = await executeEnableFreeFrame({
      loc: FRAME,
      tag: 'div',
      currentClassName: 'grid gap-4',
      grid: 8,
      tailwindMajor: 4,
      measurePayload: measure([
        ['src/pages/Home.tsx:4:7', 0, 3],
        ['src/pages/Home.tsx:5:7', 0, 117],
        ['src/pages/Home.tsx:6:7', 0, 230],
      ]),
    });

    expect(error).toBeUndefined();
    expect(batchSpy).toHaveBeenCalledTimes(1);
    expect(batchEdits(batchSpy)).toEqual([
      { kind: 'setFlag', loc: FRAME, tag: 'div', name: 'data-rc-free', on: true },
      {
        kind: 'setClassName',
        loc: FRAME,
        tag: 'div',
        before: 'grid gap-4',
        after: 'grid gap-4 relative h-[300px]',
      },
      {
        kind: 'setClassName',
        loc: 'src/pages/Home.tsx:4:7',
        tag: 'div',
        before: 'p-4',
        after: 'p-4 absolute left-0 top-0',
      },
      {
        kind: 'setClassName',
        loc: 'src/pages/Home.tsx:5:7',
        tag: 'div',
        before: '',
        after: 'absolute left-0 top-30',
      },
      {
        kind: 'setClassName',
        loc: 'src/pages/Home.tsx:6:7',
        tag: 'div',
        before: 'relative z-10 w-40',
        after: 'w-40 absolute left-0 top-58',
      },
    ]);
  });

  it('Scenario 9b: Tailwind v3 writes arbitrary px', async () => {
    const batchSpy = vi
      .spyOn(sourceClient, 'editSourceBatch')
      .mockResolvedValue({ changed: true, files: ['src/pages/Home.tsx'] });
    mockSources({ 'src/pages/Home.tsx:4:7': { kind: 'static', value: 'p-4' } });

    await executeEnableFreeFrame({
      loc: FRAME,
      tag: 'div',
      currentClassName: 'relative h-40',
      grid: 8,
      tailwindMajor: 3,
      measurePayload: { ...measure([['src/pages/Home.tsx:4:7', 16, 40]]), hasHeight: true },
    });

    const edits = batchEdits(batchSpy);
    expect(edits[1]).toMatchObject({ after: 'relative h-40' });
    expect(edits[2]).toMatchObject({ after: 'p-4 absolute left-[16px] top-[40px]' });
  });

  it('Scenario 10: a child with className={…} stops with E023 and writes nothing', async () => {
    const batchSpy = vi.spyOn(sourceClient, 'editSourceBatch');
    mockSources({
      'src/pages/Home.tsx:4:7': { kind: 'static', value: 'p-4' },
      'src/pages/Home.tsx:5:7': { kind: 'expression', code: 'cls' },
    });

    const error = await executeEnableFreeFrame({
      loc: FRAME,
      tag: 'div',
      currentClassName: '',
      grid: 8,
      tailwindMajor: 4,
      measurePayload: measure([
        ['src/pages/Home.tsx:4:7', 0, 0],
        ['src/pages/Home.tsx:5:7', 0, 80],
      ]),
    });

    expect(error).toMatchObject({ code: 'E023', params: { reason: 'classExpression' } });
    expect(batchSpy).not.toHaveBeenCalled();
  });

  it('a child whose source cannot be read stops the batch instead of shifting positions', async () => {
    const batchSpy = vi.spyOn(sourceClient, 'editSourceBatch');
    mockSources({
      'src/pages/Home.tsx:4:7': 'missing',
      'src/pages/Home.tsx:5:7': { kind: 'static', value: 'p-4' },
    });

    const error = await executeEnableFreeFrame({
      loc: FRAME,
      tag: 'div',
      currentClassName: '',
      grid: 8,
      tailwindMajor: 4,
      measurePayload: measure([
        ['src/pages/Home.tsx:4:7', 0, 0],
        ['src/pages/Home.tsx:5:7', 0, 80],
      ]),
    });

    expect(error).toMatchObject({ code: 'E016' });
    expect(batchSpy).not.toHaveBeenCalled();
  });
});

describe('Duplicate / paste placement in a free frame [R-FF-12]', () => {
  beforeEach(() => {
    useSelectionStore.getState().setTree(
      [
        { ref: { loc: FRAME, index: 0 }, tag: 'div', instances: 1 },
        { ref: { loc: 'src/pages/Home.tsx:4:7', index: 0 }, tag: 'div', parent: 0, instances: 1 },
      ],
      false,
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFrame(free: boolean) {
    vi.spyOn(sourceClient, 'fetchElementSourceByLoc').mockImplementation((loc) =>
      Promise.resolve(
        loc === FRAME
          ? source(loc, { kind: 'static', value: 'relative' }, free)
          : source(loc, { kind: 'static', value: 'absolute left-8 top-[40px] w-1/2' }),
      ),
    );
  }

  it('Scenario 7: next to an element in a free frame → its position + 16 px', async () => {
    mockFrame(true);
    const placement = await freeStackPlacement({
      kind: 'sibling',
      ref: { loc: 'src/pages/Home.tsx:4:7', tag: 'div' },
      where: 'after',
    });
    expect(placement).toEqual({ kind: 'free', left: 48, top: 56 });
  });

  it('pasting as a child of a free frame starts at its origin + 16 px', async () => {
    mockFrame(true);
    const placement = await freeStackPlacement({
      kind: 'child',
      parent: { loc: FRAME, tag: 'div' },
      where: 'end',
    });
    expect(placement).toEqual({ kind: 'free', left: 16, top: 16 });
  });

  it('outside a free frame there is no placement', async () => {
    mockFrame(false);
    const placement = await freeStackPlacement({
      kind: 'sibling',
      ref: { loc: 'src/pages/Home.tsx:4:7', tag: 'div' },
      where: 'after',
    });
    expect(placement).toBeUndefined();
  });
});
