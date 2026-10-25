// Tests for side panels and tab switching based on styling editable state (SPEC-04 Round S1, R-PJ-02).
import type { ProjectInfo } from '@kumicraft/shared';
import { cleanup, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { useProjectStore } from '../project/project-store.ts';
import { RightPanel } from './side-panels.tsx';

const CSS_PROJECT: ProjectInfo = {
  id: 'proj000001',
  name: 'CSS Project',
  root: '/test',
  sourceDir: 'src',
  support: {
    supported: true,
    reasons: [],
    framework: 'vite-react',
    versions: {},
    language: 'ts',
    styling: {
      systems: [{ id: 'css' }],
      primary: 'css',
      editable: false,
      globalCss: ['src/index.css'],
    },
  },
  needsInstall: false,
  responsiveMode: 'desktop-first',
  frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
  primaryFrameId: 'desktop',
  backends: [],
  designDirs: {
    pages: 'src/pages',
    layouts: 'src/layouts',
    components: 'src/components',
    drafts: 'src/drafts',
  },
  trusted: true,
};

const STYLED_COMPONENTS_PROJECT: ProjectInfo = {
  ...CSS_PROJECT,
  support: {
    ...CSS_PROJECT.support,
    styling: {
      systems: [{ id: 'styledComponents' }],
      primary: 'styledComponents',
      editable: false,
      globalCss: [],
    },
  },
};

describe('SidePanels - Situation #14 [R-PJ-02]', () => {
  beforeEach(async () => {
    await initI18n();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    useProjectStore.getState().setProject(undefined);
  });

  it('Situation #14: saved tab is brand, opening a project with no style adapter switches panel to Properties [R-PJ-02, R-ST-02]', () => {
    localStorage.setItem('kumicraft.rightPanelTab', 'brand');
    useProjectStore.getState().setProject(STYLED_COMPONENTS_PROJECT);

    render(<RightPanel />);

    // styled-components has no adapter yet, so there is no Brand (R-ST-02)
    expect(screen.queryByTestId('right-tab-brand')).toBeNull();

    // Title and selected tab should be Properties
    expect(screen.getByRole('heading', { name: i18next.t('editor.properties') })).toBeDefined();
    expect(
      screen.getByRole('tab', { name: i18next.t('editor.properties'), selected: true }),
    ).toBeDefined();
  });

  it('keeps the Brand tab for a plain CSS project, whose :root variables are its tokens [R-ST-11]', () => {
    localStorage.setItem('kumicraft.rightPanelTab', 'brand');
    useProjectStore.getState().setProject(CSS_PROJECT);

    render(<RightPanel />);

    expect(screen.getByTestId('right-tab-brand')).toBeDefined();
    expect(screen.getByRole('tab', { name: i18next.t('brand.tab'), selected: true })).toBeDefined();
  });
});
