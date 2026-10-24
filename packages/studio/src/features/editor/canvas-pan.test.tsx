// @vitest-environment happy-dom
import { matchShortcut } from '@reactcraft/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { DrawToolbar } from '../draw/draw-toolbar.tsx';
import { runShortcut } from '../shortcuts/shortcut-actions.ts';
import { CanvasPanSurface, PannedContent } from './canvas-pan.tsx';
import { useCanvasViewStore } from './canvas-view-store.ts';

function PannedCanvas() {
  return (
    <>
      <PannedContent>
        <span data-testid="page" />
      </PannedContent>
      <CanvasPanSurface />
    </>
  );
}

const transformOf = () => screen.getByTestId('canvas-pan-content').style.transform;

describe('Pan tool [R-DT-16]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    useCanvasViewStore.setState({
      mode: 'design',
      tool: 'select',
      panning: false,
      pan: { x: 0, y: 0 },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('the toolbar button turns panning on, and picking another tool turns it off', () => {
    render(<DrawToolbar />);
    const pan = screen.getByTestId('draw-tool-pan');
    const select = screen.getByTestId('draw-tool-select');

    fireEvent.click(pan);
    expect(pan.getAttribute('aria-pressed')).toBe('true');
    expect(select.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(select);
    expect(useCanvasViewStore.getState().panning).toBe(false);
    expect(select.getAttribute('aria-pressed')).toBe('true');
  });

  it('dragging the surface moves the frame by the drag; no surface without the tool', () => {
    render(<PannedCanvas />);
    expect(screen.queryByTestId('canvas-pan-surface')).toBeNull();
    expect(transformOf()).toBe('');

    act(() => {
      useCanvasViewStore.getState().setPanning(true);
    });
    const surface = screen.getByTestId('canvas-pan-surface');
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 140, clientY: 70 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 150, clientY: 60 });
    fireEvent.pointerUp(surface, { pointerId: 1 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 400, clientY: 400 });

    expect(transformOf()).toBe('translate(50px, -40px)');
  });

  it('H turns the tool on, "Fit" puts the frame back, preview mode turns the tool off', () => {
    expect(
      matchShortcut({ key: 'h', ctrl: false, meta: false, shift: false, alt: false }, false),
    ).toBe('toolPan');
    expect(runShortcut('toolPan')).toBe(true);
    expect(useCanvasViewStore.getState().panning).toBe(true);

    useCanvasViewStore.getState().panBy(30, 10);
    useCanvasViewStore.getState().zoomFit();
    expect(useCanvasViewStore.getState().pan).toEqual({ x: 0, y: 0 });

    useCanvasViewStore.getState().setMode('preview');
    expect(useCanvasViewStore.getState().panning).toBe(false);
  });
});
