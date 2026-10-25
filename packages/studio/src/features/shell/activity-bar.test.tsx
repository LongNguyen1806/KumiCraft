import { cleanup, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { usePanelLayoutStore } from '../editor/use-panel-layout.ts';
import { ActivityBar } from './activity-bar.tsx';
import { useActivityStore } from './activity-store.ts';

// Mock useDrafts and useStyleLayerSupported so default rendering does not trigger network
vi.mock('../drafts/use-drafts.ts', () => ({
  useDrafts: () => ({ drafts: [] }),
}));

vi.mock('../project/use-style-edit.ts', () => ({
  useStyleLayerSupported: () => true,
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

describe('ActivityBar [WP-4.00]', () => {
  it('Test 5: renders all 6 activity icons plus settings in exact order, active item has aria-pressed="true" [WP-4.00]', () => {
    useActivityStore.getState().setActive('layers');
    usePanelLayoutStore.getState().show('left');

    render(<ActivityBar context={{ brandSupported: true, draftCount: 0 }} />);

    const buttons = screen.getAllByRole('button');
    const testIds = buttons.map((b) => b.getAttribute('data-testid'));

    expect(testIds).toEqual([
      'activity-files',
      'activity-layers',
      'activity-library',
      'activity-components',
      'activity-pages',
      'activity-drafts',
      'activity-brand',
      'activity-settings',
    ]);

    expect(screen.getByTestId('activity-layers').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('activity-library').getAttribute('aria-pressed')).toBe('false');

    // When left panel collapses, aria-pressed is false
    usePanelLayoutStore.getState().toggle('left');
    cleanup();
    render(<ActivityBar context={{ brandSupported: true, draftCount: 0 }} />);
    expect(screen.getByTestId('activity-layers').getAttribute('aria-pressed')).toBe('false');
  });

  it('Test 6: hides activity-brand for unsupported styling like styled-components, shows for CSS [WP-4.00]', () => {
    // Unsupported styling (brandSupported = false)
    const { unmount } = render(<ActivityBar context={{ brandSupported: false }} />);
    expect(screen.queryByTestId('activity-brand') ?? undefined).toBeUndefined();
    unmount();

    // Supported CSS styling (brandSupported = true)
    render(<ActivityBar context={{ brandSupported: true }} />);
    expect(screen.getByTestId('activity-brand')).toBeDefined();
  });

  it('Test 7: shows draft count badge when > 0, hides when 0 [WP-4.00]', () => {
    // 3 drafts -> badge shows '3'
    const { unmount } = render(<ActivityBar context={{ draftCount: 3 }} />);
    const badge = screen.getByTestId('activity-badge-drafts');
    expect(badge.textContent).toBe('3');
    unmount();

    // 0 drafts -> no badge rendered
    render(<ActivityBar context={{ draftCount: 0 }} />);
    expect(screen.queryByTestId('activity-badge-drafts') ?? undefined).toBeUndefined();
  });
});
