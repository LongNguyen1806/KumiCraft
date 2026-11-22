// @vitest-environment happy-dom
// The snap switch beside the grid (spec-log #125): it is on by default, remembers the choice, and
// sends the grid with the switch and the zoom again whenever either changes.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { studioBridgeChannel } from '../../core/bridge-channel.ts';
import { getStoredSnap, useCanvasViewStore } from '../../core/canvas-view-store.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { GridSelect } from './canvas-grid-select.tsx';

beforeAll(async () => {
  await initI18n();
});

beforeEach(() => {
  localStorage.clear();
  useCanvasViewStore.setState({ snap: true, grid: 8, displayedZoom: 1 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('snap toggle [spec-log #125]', () => {
  it('turns snapping off and on, remembers it, and tells the Bridge each time', () => {
    // The payload (size, snap, scale read from this store) is checked in bridge-channel.test.ts.
    const setGrid = vi.spyOn(studioBridgeChannel, 'setGrid').mockImplementation(() => undefined);
    render(<GridSelect />);
    const toggle = screen.getByTestId('canvas-snap-toggle');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(setGrid).toHaveBeenCalledTimes(1);

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(useCanvasViewStore.getState().snap).toBe(false);
    expect(getStoredSnap()).toBe(false);
    expect(setGrid).toHaveBeenCalledTimes(2);

    act(() => {
      useCanvasViewStore.getState().setDisplayedZoom(0.5);
    });
    expect(setGrid).toHaveBeenCalledTimes(3);

    fireEvent.click(toggle);
    expect(getStoredSnap()).toBe(true);
    expect(setGrid).toHaveBeenCalledTimes(4);
    expect(setGrid).toHaveBeenLastCalledWith(8);
  });
});
