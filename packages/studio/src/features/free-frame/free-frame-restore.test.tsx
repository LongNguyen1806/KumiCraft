// Round trip through the real switch (spec-log #126): turning a frame on and off again gives the
// code back as it was; a child moved in between keeps its new place; with no record (turned on
// by an older version) the switch still asks and puts children in the flow.
import type { BatchEdit, BridgeFreeMeasurePayload, ElementSource } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { asWritten } from '../../api/written-class-test-support.ts';
import { useCanvasViewStore } from '../../core/canvas-view-store.ts';
import { useSelectionStore } from '../../core/selection-store.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { executeEnableFreeFrame } from './free-frame-ops.ts';
import { saveFreeSnapshot } from './free-frame-snapshot.ts';
import { FreeFrameToggle } from './free-frame-toggle.tsx';

const FRAME = 'src/pages/Login.tsx:10:5';
const LOGO = 'src/pages/Login.tsx:11:7';
const TEXT = 'src/pages/Login.tsx:12:7';
const ORIGINAL: Readonly<Record<string, string>> = {
  [FRAME]: 'hidden lg:flex flex-col items-center',
  [LOGO]: 'absolute top-8 right-8 w-44',
  [TEXT]: 'relative z-10 max-w-xl text-center',
};

/** The file as the server holds it: classes by element, and the frame's flag. */
let code: Map<string, string>;
let free: boolean;

function sourceOf(loc: string): ElementSource {
  return {
    loc,
    tag: 'div',
    fileHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    className: { kind: 'static', value: code.get(loc) ?? '' },
    text: { kind: 'none' },
    attributes: {},
    inLoop: false,
    free: loc === FRAME && free,
  };
}

function apply(edits: readonly BatchEdit[]): void {
  for (const edit of edits) {
    if (edit.kind === 'setFlag') free = edit.on;
    const written = asWritten(edit);
    if (written.kind === 'setClassName') {
      // The server refuses an edit made against classes that are no longer there.
      expect(code.get(written.loc)).toBe(written.before);
      code.set(written.loc, written.after);
    }
  }
}

const measure: BridgeFreeMeasurePayload = {
  ref: { loc: FRAME, index: 0 },
  width: 838,
  height: 898,
  hasHeight: false,
  children: [
    { ref: { loc: LOGO, index: 0 }, tag: 'div', left: 600, top: 32, width: 176, height: 176 },
    { ref: { loc: TEXT, index: 0 }, tag: 'div', left: 160, top: 360, width: 576, height: 200 },
  ],
};

async function turnOn(): Promise<void> {
  await executeEnableFreeFrame({
    loc: FRAME,
    tag: 'div',
    currentClassName: code.get(FRAME) ?? '',
    grid: 8,
    measurePayload: measure,
    remember: (snapshot) => {
      saveFreeSnapshot('p1', snapshot);
    },
  });
}

function renderSwitch() {
  useSelectionStore.getState().setSelectedRefs([{ loc: FRAME, index: 0 }]);
  return render(<FreeFrameToggle source={sourceOf(FRAME)} />);
}

beforeAll(async () => {
  await initI18n();
});

beforeEach(() => {
  localStorage.clear();
  code = new Map(Object.entries(ORIGINAL));
  free = false;
  useSelectionStore.getState().reset();
  useSelectionStore.getState().setTree([
    { ref: { loc: FRAME, index: 0 }, tag: 'div', instances: 1 },
    { ref: { loc: LOGO, index: 0 }, tag: 'div', parent: 0, instances: 1 },
    { ref: { loc: TEXT, index: 0 }, tag: 'div', parent: 0, instances: 1 },
  ]);
  useCanvasViewStore.setState({ currentProjectId: 'p1' });
  vi.spyOn(sourceClient, 'fetchElementSourceByLoc').mockImplementation((loc) =>
    Promise.resolve(code.has(loc) ? sourceOf(loc) : undefined),
  );
  vi.spyOn(sourceClient, 'editSourceBatch').mockImplementation(({ edits }) => {
    apply(edits);
    return Promise.resolve({ changed: true, files: ['src/pages/Login.tsx'] });
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('free frame off gives back what on replaced [spec-log #126]', () => {
  it('on, then off with nothing moved: the code is exactly as before, without a question', async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    await turnOn();
    expect(free).toBe(true);
    expect(code.get(LOGO)).not.toBe(ORIGINAL[LOGO]);

    const view = renderSwitch();
    fireEvent.click(screen.getByTestId('free-frame-toggle'));
    await waitFor(() => {
      expect(free).toBe(false);
    });
    expect(Object.fromEntries(code)).toEqual(ORIGINAL);
    expect(confirm).not.toHaveBeenCalled();

    view.rerender(<FreeFrameToggle source={sourceOf(FRAME)} />);
    expect(screen.getByTestId('free-frame-restored').textContent).toContain('2');
  });

  it('a child moved in between keeps its new place; the others and the frame role stay right', async () => {
    await turnOn();
    // The user drags the text block: only its coordinates change.
    const moved = (code.get(TEXT) ?? '').replace('left-40', 'left-52');
    code.set(TEXT, moved);

    const view = renderSwitch();
    fireEvent.click(screen.getByTestId('free-frame-toggle'));
    await waitFor(() => {
      expect(free).toBe(false);
    });
    expect(code.get(TEXT)).toBe(moved);
    expect(code.get(LOGO)).toBe(ORIGINAL[LOGO]);
    // Still the positioning parent of the moved block, so it does not jump.
    expect(code.get(FRAME)?.split(' ')).toContain('relative');

    view.rerender(<FreeFrameToggle source={sourceOf(FRAME)} />);
    const notice = screen.getByTestId('free-frame-restored').textContent;
    expect(notice).toContain('1');
  });

  it('with no record the switch asks, then puts the children in the flow as before', async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    free = true;
    code.set(LOGO, 'w-44 absolute left-150 top-8');

    renderSwitch();
    fireEvent.click(screen.getByTestId('free-frame-toggle'));
    expect(confirm).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(free).toBe(false);
    });
    expect(code.get(LOGO)).toBe('w-44');
    expect(screen.queryByTestId('free-frame-restored')).toBeNull();
  });

  it('a failed write on turning on records nothing', async () => {
    vi.spyOn(sourceClient, 'editSourceBatch').mockRejectedValue(new Error('offline'));
    await turnOn();
    expect(localStorage.getItem('kumicraft.freeFrameSnapshots.p1')).toBeNull();
  });
});
