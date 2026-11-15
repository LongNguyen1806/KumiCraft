// Drafts open per frame (spec-log #148, the owner's report of 2026-11-15): session 1 showed a draft
// while session 2 had to show the landing page, but the draft was one for all frames.
import { beforeEach, describe, expect, it } from 'vitest';

import { useCanvasViewStore } from './canvas-view-store.ts';

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
