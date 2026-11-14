// @vitest-environment happy-dom
// Unit tests for Library style selector persistence, project uiKit badges, and block insertion (TK-44, TK-69).
import { LIBRARY_BLOCKS, type ProjectInfo } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useThemeStore } from '../inspector/use-project-theme.ts';
import { useProjectStore } from '../project/project-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { insertBlockAt, resetThemeLookAttempt } from './insert-block.ts';
import { LibraryPanel } from './library-panel.tsx';

function makeProject(overrides: Partial<ProjectInfo['support']> = {}): ProjectInfo {
  return {
    id: 'proj-stage-b',
    name: 'Test Project',
    root: '/tmp/proj',
    sourceDir: 'src',
    support: {
      supported: true,
      reasons: [],
      framework: 'vite-react',
      versions: { vite: '8.0.0', react: '19.0.0', tailwindcss: '4.1.0' },
      language: 'ts',
      styling: {
        systems: [{ id: 'tailwind', version: '4.1.0' }],
        editable: true,
        globalCss: ['src/index.css'],
        primary: 'tailwind',
      },
      ...overrides,
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
}

describe('Library Stage B (uiKit + style presets)', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    localStorage.clear();
    resetThemeLookAttempt();
    useSelectionStore.getState().reset();
    useThemeStore.setState({
      theme: {
        file: 'src/index.css',
        colors: [{ name: 'brand', value: '#3b82f6' }],
        fontSizes: [],
        radii: [],
        fonts: [],
        shadows: [],
        breakpoints: [],
      },
    });
    useProjectStore.getState().setProject(makeProject());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('persists library style per project in localStorage and applies it on insert', async () => {
    const view = render(<LibraryPanel />);
    const select = screen.getByTestId('library-style-select');
    expect(select).toHaveProperty('value', 'default');

    fireEvent.change(select, { target: { value: 'glass' } });
    expect(localStorage.getItem('kumicraft.libraryStyle.proj-stage-b')).toBe('glass');

    view.unmount();
    render(<LibraryPanel />);
    expect(screen.getByTestId('library-style-select')).toHaveProperty('value', 'glass');

    const editSpy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/App.tsx'],
      locs: ['src/App.tsx:10:5'],
      warnings: [],
    });
    const cardBlock = LIBRARY_BLOCKS.find((b) => b.id === 'composite.card');
    expect(cardBlock).toBeDefined();
    if (cardBlock === undefined) return;

    await insertBlockAt(
      cardBlock,
      { kind: 'child', parent: { loc: 'src/App.tsx:2:3', tag: 'div' }, where: 'end' },
      'en',
    );
    expect(editSpy).toHaveBeenCalledTimes(1);
    const call = editSpy.mock.calls[0]?.[0];
    expect(call?.kind).toBe('insert');
    if (call?.kind === 'insert') {
      expect(call.jsx).toContain('backdrop-blur-md');
      expect(call.jsx).toContain('text-brand');
    }
  });

  it('shows from-project badge only for detected uiKit blocks and sends imports on insert', async () => {
    useProjectStore.getState().setProject(
      makeProject({
        uiKit: {
          kind: 'shadcn',
          uiDir: 'src/components/ui',
          importBase: '@/components/ui',
          components: ['button'],
        },
      }),
    );

    render(<LibraryPanel />);
    expect(screen.getByTestId('library-kit-badge-form.button')).toBeDefined();
    expect(screen.queryAllByTestId('library-kit-badge-composite.card')).toHaveLength(0);

    const editSpy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/App.tsx'],
      locs: ['src/App.tsx:10:5'],
      warnings: [],
    });
    const btnBlock = LIBRARY_BLOCKS.find((b) => b.id === 'form.button');
    expect(btnBlock).toBeDefined();
    if (btnBlock === undefined) return;

    await insertBlockAt(
      btnBlock,
      { kind: 'child', parent: { loc: 'src/App.tsx:2:3', tag: 'div' }, where: 'end' },
      'en',
      undefined,
      undefined,
      'outline',
    );
    const call = editSpy.mock.calls[0]?.[0];
    expect(call?.kind).toBe('insert');
    if (call?.kind === 'insert') {
      expect(call.jsx).toContain('<Button variant="outline"');
      expect(call.from?.imports).toEqual(["import { Button } from '@/components/ui/button';"]);
    }
  });
});
