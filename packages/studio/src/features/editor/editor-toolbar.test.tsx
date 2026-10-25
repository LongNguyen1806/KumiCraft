import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { ActivityBar } from '../shell/activity-bar.tsx';
import { useActivityStore } from '../shell/activity-store.ts';
import { EditorToolbar } from './editor-toolbar.tsx';
import { usePanelLayout, usePanelLayoutStore } from './use-panel-layout.ts';

vi.mock('../drafts/use-drafts.ts', () => ({
  useDrafts: () => ({ drafts: [] }),
}));

vi.mock('../project/use-style-edit.ts', () => ({
  useStyleLayerSupported: () => true,
}));

vi.mock('./use-runner-status.ts', () => ({
  useRunnerStatus: () => ({
    status: { state: 'stopped' },
    logTail: [],
    start: vi.fn(),
    restart: vi.fn(),
  }),
}));

beforeAll(async () => {
  await initI18n();
});

beforeEach(async () => {
  await i18next.changeLanguage('vi');
  localStorage.clear();
  useActivityStore.getState().initFromStorage();
  usePanelLayoutStore.getState().show('left');
});

afterEach(() => {
  cleanup();
});

function ToolbarActivityHarness() {
  const { layout, toggle } = usePanelLayout();
  return (
    <div>
      <ActivityBar context={{ brandSupported: true, draftCount: 0 }} />
      <EditorToolbar projectName="Test" visible={layout.visible} onToggle={toggle} />
    </div>
  );
}

describe('EditorToolbar & PanelToggle [WP-4.00]', () => {
  it('Test 11: left round toggle button and activate share state; collapse with round button then click activity icon opens it; aria-pressed updates accordingly [WP-4.00]', () => {
    useActivityStore.getState().setActive('layers');
    usePanelLayoutStore.getState().show('left');

    render(<ToolbarActivityHarness />);

    // Round left toggle button
    const leftRoundToggle = screen.getByRole('button', {
      name: /panel trái/i,
    });
    expect(leftRoundToggle.getAttribute('aria-pressed')).toBe('true');

    // 1. Collapse with round button
    fireEvent.click(leftRoundToggle);
    expect(usePanelLayoutStore.getState().layout.visible.left).toBe(false);
    expect(leftRoundToggle.getAttribute('aria-pressed')).toBe('false');

    // 2. Click activity icon 'library' -> opens panel
    const libraryIcon = screen.getByTestId('activity-library');
    fireEvent.click(libraryIcon);

    expect(useActivityStore.getState().active).toBe('library');
    expect(usePanelLayoutStore.getState().layout.visible.left).toBe(true);
    expect(leftRoundToggle.getAttribute('aria-pressed')).toBe('true');
    expect(libraryIcon.getAttribute('aria-pressed')).toBe('true');

    // 3. Click activity icon 'library' again -> collapses panel
    fireEvent.click(libraryIcon);
    expect(usePanelLayoutStore.getState().layout.visible.left).toBe(false);
    expect(leftRoundToggle.getAttribute('aria-pressed')).toBe('false');
    expect(libraryIcon.getAttribute('aria-pressed')).toBe('false');
  });
});
