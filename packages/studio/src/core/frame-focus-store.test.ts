// One frame at a time: stepping, the ends, Esc, and the choice kept per project (WP-4.00).
import { matchShortcut } from '@kumicraft/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { useCanvasViewStore } from './canvas-view-store.ts';
import {
  exitFrameFocus,
  focusFrame,
  stepFrame,
  toggleFrameFocus,
  useFrameFocusStore,
} from './frame-focus-store.ts';

const frame = (id: string) => ({ id, frameId: 'desktop', sessionId: 1, route: '/' });
const key = (k: string, shift = false) => ({ key: k, ctrl: false, meta: false, shift, alt: false });

describe('frame focus [WP-4.00]', () => {
  beforeEach(() => {
    localStorage.clear();
    useFrameFocusStore.setState({ focus: false, direction: 0, projectId: undefined });
    useCanvasViewStore.setState({
      openFrames: [frame('a'), frame('b'), frame('c')],
      activeOpenFrameId: 'a',
    });
  });

  it('shows one frame, steps both ways without wrapping, and Esc goes back side by side', () => {
    focusFrame('b');
    expect(useFrameFocusStore.getState().focus).toBe(true);
    expect(useCanvasViewStore.getState().activeOpenFrameId).toBe('b');
    expect(useCanvasViewStore.getState().zoom).toBe('fit');

    expect(stepFrame(1)).toBe(true);
    expect(useCanvasViewStore.getState().activeOpenFrameId).toBe('c');
    expect(useFrameFocusStore.getState().direction).toBe(1);
    // The last frame: no wrap to the first.
    expect(stepFrame(1)).toBe(false);
    expect(useCanvasViewStore.getState().activeOpenFrameId).toBe('c');
    expect(stepFrame(-1)).toBe(true);
    expect(useFrameFocusStore.getState().direction).toBe(-1);

    expect(exitFrameFocus()).toBe(true);
    expect(useFrameFocusStore.getState().focus).toBe(false);
    // Nothing left to leave: Esc does nothing more.
    expect(exitFrameFocus()).toBe(false);
  });

  it('needs two frames, and remembers the choice per project', () => {
    useCanvasViewStore.setState({ openFrames: [frame('a')], activeOpenFrameId: 'a' });
    expect(toggleFrameFocus()).toBe(false);
    expect(useFrameFocusStore.getState().focus).toBe(false);

    useCanvasViewStore.setState({ openFrames: [frame('a'), frame('b')] });
    useFrameFocusStore.getState().load('p1');
    expect(toggleFrameFocus()).toBe(true);
    useFrameFocusStore.getState().load('p2');
    expect(useFrameFocusStore.getState().focus).toBe(false);
    useFrameFocusStore.getState().load('p1');
    expect(useFrameFocusStore.getState().focus).toBe(true);
  });

  it('maps Shift+2 to one frame at a time, N and Shift+N to the next and previous frame', () => {
    expect(matchShortcut(key('2', true), false)).toBe('toggleFrameFocus');
    expect(matchShortcut(key('@', true), false)).toBe('toggleFrameFocus');
    expect(matchShortcut(key('n'), false)).toBe('frameNext');
    expect(matchShortcut(key('N', true), false)).toBe('framePrev');
    // The arrows still nudge the selection.
    expect(matchShortcut(key('ArrowRight'), false)).toBe('nudgeRight');
  });
});
