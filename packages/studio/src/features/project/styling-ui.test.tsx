// Tests for Studio UI on plain CSS vs Tailwind 4 projects (SPEC-04 Round S1, R-PJ-02).
import type { ElementSource, ProjectInfo } from '@kumicraft/shared';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as eventsClient from '../../api/events-client.ts';
import * as sourceClient from '../../api/source-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { DrawToolbar } from '../draw/draw-toolbar.tsx';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { RightPanel } from '../editor/side-panels.tsx';
import { StatusBar } from '../editor/status-bar.tsx';
import { InspectorPanel } from '../inspector/inspector-panel.tsx';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useProjectStore } from './project-store.ts';

const CSS_PROJECT: ProjectInfo = {
  id: 'proj000001',
  name: 'Plain CSS Project',
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

const TAILWIND4_PROJECT: ProjectInfo = {
  id: 'proj000002',
  name: 'Tailwind 4 Project',
  root: '/test',
  sourceDir: 'src',
  support: {
    supported: true,
    reasons: [],
    framework: 'vite-react',
    versions: { tailwindcss: '4.0.0' },
    language: 'ts',
    tailwindCss: 'src/index.css',
    styling: {
      systems: [{ id: 'tailwind', version: '4.0.0' }, { id: 'css' }],
      primary: 'tailwind',
      editable: true,
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

const SAMPLE_SOURCE: ElementSource = {
  loc: 'src/App.tsx:12:4',
  tag: 'button',
  fileHash: 'b'.repeat(64),
  className: {
    kind: 'static',
    value: 'btn btn-primary',
  },
  text: { kind: 'none' },
  attributes: {},
  inLoop: false,
};

describe('Studio styling UI - Situations #11 & #12 [R-PJ-02]', () => {
  beforeEach(async () => {
    await initI18n();
    localStorage.clear();
    vi.spyOn(eventsClient, 'createEventsClient').mockReturnValue({
      close: vi.fn(),
      isConnected: () => true,
    });
    vi.spyOn(sourceClient, 'fetchElementSource').mockResolvedValue(SAMPLE_SOURCE);
    useCanvasViewStore.getState().setMode('design');
    useCanvasViewStore.getState().setTool('select');
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    useProjectStore.getState().setProject(undefined);
    useSelectionStore.getState().reset();
    vi.restoreAllMocks();
  });

  it('Situation #11: Studio with plain CSS project hides visual tools and shows unsupported notice [R-PJ-02]', async () => {
    useProjectStore.getState().setProject(CSS_PROJECT);
    act(() => {
      useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:12:4', index: 0 }]);
      useSelectionStore
        .getState()
        .setSelectionInfo([
          { ref: { loc: 'src/App.tsx:12:4', index: 0 }, found: true, tag: 'button', instances: 1 },
        ]);
      useSelectionStore.getState().setTree([
        {
          ref: { loc: 'src/App.tsx:12:4', index: 0 },
          tag: 'button',
          instances: 1,
        },
      ]);
    });

    // 1. Status bar
    const { unmount: unmountStatus } = render(<StatusBar trusted={true} />);
    const badge = screen.getByTestId('styling-label');
    expect(badge.textContent).toContain('CSS');
    expect(badge.getAttribute('title')).toContain(
      i18next.t('project.styleNotEditable', {
        defaultValue: 'Chỉnh kiểu dáng trực quan: chưa hỗ trợ cho hệ này, dùng AI để đổi kiểu dáng',
      }),
    );
    unmountStatus();

    // 2. Draw toolbar only has select tool
    const { unmount: unmountDraw } = render(<DrawToolbar />);
    expect(screen.getByTestId('draw-tool-select')).toBeDefined();
    expect(screen.queryByTestId('draw-tool-frame')).toBeNull();
    expect(screen.queryByTestId('draw-tool-text')).toBeNull();
    expect(screen.queryByTestId('draw-tool-image')).toBeNull();
    unmountDraw();

    // 3. RightPanel keeps Brand: the style layer reads a CSS project's :root tokens (R-ST-11)
    const { unmount: unmountRight } = render(<RightPanel />);
    expect(screen.getByTestId('right-tab-brand')).toBeDefined();
    unmountRight();

    // 4. Inspector has inspector-style-unsupported, no color/spacing groups, but has element path
    render(<InspectorPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('inspector-panel')).toBeDefined();
    });

    expect(screen.getByTestId('inspector-style-unsupported')).toBeDefined();
    expect(screen.getByTestId('element-path')).toBeDefined();
    expect(screen.getByTestId('tag-attributes-section')).toBeDefined();
    expect(screen.queryByTestId('color-field-textColor')).toBeNull();
    expect(screen.queryByTestId('other-classes-section')).toBeNull();
  });

  it('Situation #12: Studio with Tailwind 4 project shows Tailwind 4 badge and all tools [R-PJ-02]', async () => {
    useProjectStore.getState().setProject(TAILWIND4_PROJECT);
    act(() => {
      useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:12:4', index: 0 }]);
      useSelectionStore
        .getState()
        .setSelectionInfo([
          { ref: { loc: 'src/App.tsx:12:4', index: 0 }, found: true, tag: 'button', instances: 1 },
        ]);
      useSelectionStore.getState().setTree([
        {
          ref: { loc: 'src/App.tsx:12:4', index: 0 },
          tag: 'button',
          instances: 1,
        },
      ]);
    });

    // 1. Status bar
    const { unmount: unmountStatus } = render(<StatusBar trusted={true} />);
    const badge = screen.getByTestId('styling-label');
    expect(badge.textContent).toContain('Tailwind 4');
    unmountStatus();

    // 2. Draw toolbar has all tools
    const { unmount: unmountDraw } = render(<DrawToolbar />);
    expect(screen.getByTestId('draw-tool-select')).toBeDefined();
    expect(screen.getByTestId('draw-tool-frame')).toBeDefined();
    expect(screen.getByTestId('draw-tool-text')).toBeDefined();
    expect(screen.getByTestId('draw-tool-image')).toBeDefined();
    unmountDraw();

    // 3. RightPanel has Brand tab
    const { unmount: unmountRight } = render(<RightPanel />);
    expect(screen.getByTestId('right-tab-brand')).toBeDefined();
    unmountRight();

    // 4. Inspector does NOT show unsupported notice, shows style groups
    render(<InspectorPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('inspector-panel')).toBeDefined();
    });

    expect(screen.queryByTestId('inspector-style-unsupported')).toBeNull();
    expect(screen.getByTestId('element-path')).toBeDefined();
    expect(screen.getByTestId('tag-attributes-section')).toBeDefined();
    expect(screen.getByTestId('other-classes-section')).toBeDefined();
  });
});
