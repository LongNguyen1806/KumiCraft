// Drafts open per frame (spec-log #148, the owner's report of 2026-11-15): session 1 showed a draft
// while session 2 had to show the landing page, but the draft was one for all frames.
import { beforeEach, describe, expect, it } from 'vitest';

import { useCanvasViewStore } from '../../core/canvas-view-store.ts';
import {
  getStoredOpenFrames,
  isDraftAddress,
  OPEN_FRAMES_STORAGE_PREFIX,
} from '../../core/open-frames-storage.ts';

const store = () => useCanvasViewStore.getState();
const frame = (id: string) => store().openFrames.find((f) => f.id === id);

beforeEach(() => {
  useCanvasViewStore.setState({
    openFrames: [{ id: 'default', frameId: 'desktop', sessionId: 1, route: '/' }],
    activeOpenFrameId: 'default',
    draftFile: undefined,
    currentProjectId: undefined,
  });
});

describe('drafts per frame', () => {
  it('a draft opened in one frame leaves the other frame on its page [WP-4.00]', () => {
    const second = store().addOpenFrame('desktop', 2, '/landing') ?? '';
    store().setActiveOpenFrameId('default');
    store().openDraft('src/drafts/Nhap.tsx');

    expect(frame('default')?.draftFile).toBe('src/drafts/Nhap.tsx');
    expect(frame(second)?.draftFile).toBe(undefined);
    expect(frame(second)?.route).toBe('/landing');

    // The panels follow the active frame: none on the page frame, the draft back on frame 1.
    store().setActiveOpenFrameId(second);
    expect(store().draftFile).toBe(undefined);
    store().setActiveOpenFrameId('default');
    expect(store().draftFile).toBe('src/drafts/Nhap.tsx');
  });

  it('closing the draft of one frame keeps it in the other; deleting it closes it everywhere [WP-4.00]', () => {
    const second = store().addOpenFrame('desktop', 2, '/') ?? '';
    store().setActiveOpenFrameId('default');
    store().openDraft('src/drafts/Nhap.tsx');
    store().setActiveOpenFrameId(second);
    store().openDraft('src/drafts/Nhap.tsx');

    store().closeDraft();
    expect(frame(second)?.draftFile).toBe(undefined);
    expect(frame('default')?.draftFile).toBe('src/drafts/Nhap.tsx');

    store().closeDraft(undefined, 'src/drafts');
    expect(frame('default')?.draftFile).toBe(undefined);
  });
});

describe('the internal draft address is never a page', () => {
  it('an older stored frame with a draft address as its route shows home [WP-4.00]', () => {
    localStorage.setItem(
      `${OPEN_FRAMES_STORAGE_PREFIX}p1`,
      JSON.stringify([
        { id: 'a', frameId: 'desktop', sessionId: 1, route: '/__kumicraft/draft?file=x' },
      ]),
    );
    expect(getStoredOpenFrames('p1')?.[0]?.route).toBe('/');
    localStorage.removeItem(`${OPEN_FRAMES_STORAGE_PREFIX}p1`);
  });

  it('knows the draft address [WP-4.00]', () => {
    expect(isDraftAddress('/__kumicraft/draft?file=src%2Fdrafts%2FA.tsx')).toBe(true);
    expect(isDraftAddress('/landing')).toBe(false);
  });
});
