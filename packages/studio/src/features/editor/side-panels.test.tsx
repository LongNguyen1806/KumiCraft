// Tests for side panels and tab switching [WP-4.00, R-PG-15, R-PJ-02].
import type { ProjectInfo } from '@kumicraft/shared';
import { act, cleanup, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { useProjectStore } from '../project/project-store.ts';
import { useActivityStore } from '../shell/activity-store.ts';
import { LeftPanel, RightPanel } from './side-panels.tsx';

vi.mock('../../api/project-client.ts', () => ({
  // The same shape as the server answers: `router` is always there (PagesInfoSchema).
  fetchPages: vi.fn().mockResolvedValue({
    pages: [],
    convention: true,
    router: { status: 'none', hasRouterPackage: false },
  }),
  fetchProjectTheme: vi.fn().mockResolvedValue({
    file: 'src/theme.css',
    system: 'css',
    colors: [],
    fontSizes: [],
    radii: [],
    fonts: [],
    shadows: [],
    breakpoints: [],
  }),
  fetchProjectDirs: vi.fn().mockResolvedValue(['src/pages']),
}));

vi.mock('../drafts/use-drafts.ts', () => ({
  useDrafts: () => ({ drafts: [], reload: vi.fn() }),
}));

/** styled-components has no style adapter yet: no Brand (R-ST-02). */
const STYLED_COMPONENTS_PROJECT: ProjectInfo = {
  id: 'proj000003',
  name: 'Styled Components Project',
  root: '/test',
  sourceDir: 'src',
  support: {
    supported: true,
    reasons: [],
    framework: 'vite-react',
    versions: {},
    language: 'ts',
    styling: {
      systems: [{ id: 'styledComponents' }],
      primary: 'styledComponents',
      editable: false,
      globalCss: [],
    },
  },
  needsInstall: false,
  responsiveMode: 'desktop-first',
  frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
  primaryFrameId: 'desktop',
  backends: [],
  designDirs: {
    pages: ['src/pages'],
    layouts: ['src/layouts'],
    components: ['src/components'],
    drafts: 'src/drafts',
  },
  trusted: true,
};

describe('SidePanels [WP-4.00]', () => {
  beforeEach(async () => {
    await initI18n();
    localStorage.clear();
    useActivityStore.getState().initFromStorage();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    useProjectStore.getState().setProject(undefined);
  });

  it('Test 8: active=pages renders PagesPanel (with add page button), active=brand renders BrandPanel, no left tab bar [WP-4.00, R-PG-15]', () => {
    useActivityStore.getState().setActive('pages');
    const { unmount } = render(<LeftPanel />);

    // Renders PagesPanel with add page button
    expect(screen.getByTestId('pages-panel')).toBeDefined();
    expect(screen.getByTestId('page-add')).toBeDefined();
    // No tab bar on the left panel
    expect(screen.queryByRole('tablist') ?? undefined).toBeUndefined();
    unmount();

    // Switch to brand
    useActivityStore.getState().setActive('brand');
    render(<LeftPanel />);

    // BrandPanel is rendered (either brand-panel or brand-empty)
    const brandElement = screen.queryByTestId('brand-panel') ?? screen.queryByTestId('brand-empty');
    expect(brandElement ?? undefined).toBeDefined();
    // Still no tab bar on the left panel
    expect(screen.queryByRole('tablist') ?? undefined).toBeUndefined();
  });

  it('Test 9: RightPanel only has Properties and Chat tabs, without right-tab-brand [WP-4.00]', () => {
    render(<RightPanel />);

    expect(screen.getByRole('tab', { name: i18next.t('editor.properties') })).toBeDefined();
    expect(screen.getByRole('tab', { name: i18next.t('editor.ai') })).toBeDefined();
    expect(screen.queryByTestId('right-tab-brand') ?? undefined).toBeUndefined();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(2);
  });

  it('shows Layers, not Brand, when Brand was open and the project has no style adapter [WP-4.00, R-ST-02]', () => {
    useActivityStore.getState().setActive('brand');
    useProjectStore.getState().setProject(STYLED_COMPONENTS_PROJECT);
    render(<LeftPanel />);

    expect(screen.getByRole('complementary', { name: i18next.t('editor.layers') })).toBeDefined();
    expect(screen.queryByTestId('brand-panel') ?? undefined).toBeUndefined();
  });

  it('keeps the open panel as it is when the interface language changes (spec-log #122)', async () => {
    useActivityStore.getState().setActive('pages');
    render(<LeftPanel />);
    const before = screen.getByTestId('pages-panel');
    const language = i18next.resolvedLanguage === 'vi' ? 'en' : 'vi';
    await act(async () => {
      await i18next.changeLanguage(language);
    });
    // The same element: the panel was not unmounted and drawn again.
    expect(screen.getByTestId('pages-panel')).toBe(before);
  });
});
