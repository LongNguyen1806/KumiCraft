// @vitest-environment happy-dom
import { DEFAULT_DESIGN_DIRS, LIBRARY_BLOCKS, type ProjectInfo } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useThemeStore } from '../inspector/use-project-theme.ts';
import { useProjectStore } from '../project/project-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useStructureErrorStore } from '../structure/structure-error-store.ts';
import { determineInsertTarget, insertBlock, resetThemeLookAttempt } from './insert-block.ts';
import { LibraryPanel } from './library-panel.tsx';
import { hasBlockPreview } from './previews/index.tsx';

describe('Library Panel and Insertion (Scenarios #14, #15)', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    localStorage.clear();
    resetThemeLookAttempt();
    useThemeStore.setState({
      theme: {
        file: 'src/index.css',
        colors: [],
        fontSizes: [],
        radii: [],
        fonts: [],
        shadows: [],
        breakpoints: [],
      },
    });
    useSelectionStore.getState().reset();
    useStructureErrorStore.getState().clearError();
    useStructureErrorStore.getState().setActiveSource(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Scenario 14: determineInsertTarget targets child end for container tags and sibling after for non-containers [R-LB-14]', async () => {
    // 1. Container: section -> child end
    const sectionTarget = determineInsertTarget({ loc: 'src/Home.tsx:10:1', index: 0 }, 'section');
    expect(sectionTarget).toEqual({
      kind: 'child',
      parent: { loc: 'src/Home.tsx:10:1', tag: 'section' },
      where: 'end',
    });

    // 2. Non-container: p -> sibling after
    const pTarget = determineInsertTarget({ loc: 'src/Home.tsx:15:3', index: 0 }, 'p');
    expect(pTarget).toEqual({
      kind: 'sibling',
      ref: { loc: 'src/Home.tsx:15:3', tag: 'p' },
      where: 'after',
    });

    // 3. No selection: insertBlock skips without calling API
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit');
    useSelectionStore.getState().setSelectedRefs([]);
    const rowBlock = LIBRARY_BLOCKS[0];
    if (!rowBlock) throw new Error('Missing block');

    const res = await insertBlock(rowBlock, 'vi');
    expect(res.ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('Scenario 15: LibraryPanel keeps blocks draggable, locks + without a hint when no selection; + inserts when selected, then selects the new element [R-LB-14, R-LB-15]', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/Home.tsx'],
      locs: ['src/Home.tsx:25:5'],
    });

    // 1. Render when nothing is selected: the block stays draggable, its + button is locked
    const { rerender } = render(<LibraryPanel />);

    expect(screen.queryByTestId('library-hint')).toBeNull();
    const buttonBlock = screen.getByTestId('library-block-form.button');
    const addButton = screen.getByTestId<HTMLButtonElement>('library-add-form.button');
    expect(buttonBlock.getAttribute('draggable')).toBe('true');
    expect(addButton.disabled).toBe(true);
    fireEvent.click(addButton);
    expect(spy).not.toHaveBeenCalled();

    // 2. Select an element on Canvas
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/Home.tsx:10:1', index: 0 }]);
    useStructureErrorStore.getState().setActiveSource({ loc: 'src/Home.tsx:10:1', tag: 'div' });
    rerender(<LibraryPanel />);

    expect(addButton.disabled).toBe(false);

    // 3. A click on the block itself inserts nothing (owner, 2026-10-23); its + button does
    fireEvent.click(buttonBlock);
    expect(spy).not.toHaveBeenCalled();
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });

    const call = spy.mock.calls[0]?.[0];
    expect(call?.kind).toBe('insert');
    if (call?.kind === 'insert') {
      expect(call.target).toEqual({
        kind: 'child',
        parent: { loc: 'src/Home.tsx:10:1', tag: 'div' },
        where: 'end',
      });
      expect(call.jsx).toContain('<button');
    }

    expect(useSelectionStore.getState().selectedRefs).toEqual([
      { loc: 'src/Home.tsx:25:5', index: 0 },
    ]);
  });

  it('11. [TK-47] shows variant picker only on blocks with variants, persists selection to localStorage, and remembers across remount', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/Home.tsx'],
      locs: ['src/Home.tsx:25:5'],
    });
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/Home.tsx:10:1', index: 0 }]);
    useStructureErrorStore.getState().setActiveSource({ loc: 'src/Home.tsx:10:1', tag: 'div' });

    const { unmount } = render(<LibraryPanel />);

    expect(screen.getByTestId('library-variant-form.button')).toBeDefined();
    expect(screen.getByTestId('library-variant-composite.card')).toBeDefined();
    expect(screen.getByTestId('library-variant-content.heading')).toBeDefined();
    expect(screen.getByTestId('library-variant-composite.hero')).toBeDefined();
    expect(screen.queryByTestId('library-variant-content.paragraph')).toBeNull();

    fireEvent.click(screen.getByTestId('library-variant-form.button'));
    expect(screen.getByTestId('library-variant-menu')).toBeDefined();
    fireEvent.click(screen.getByTestId('library-variant-form.button-outline'));

    expect(localStorage.getItem('kumicraft.libraryVariant.form.button')).toBe('outline');
    expect(screen.queryByTestId('library-variant-menu')).toBeNull();

    fireEvent.click(screen.getByTestId('library-variant-form.button'));
    const outlineItem = screen.getByTestId('library-variant-form.button-outline');
    expect(outlineItem.textContent).toContain('✓');
    expect(screen.getByTestId('library-variant-form.button-default').textContent).not.toContain(
      '✓',
    );
    unmount();

    render(<LibraryPanel />);
    fireEvent.click(screen.getByTestId('library-variant-form.button'));
    expect(screen.getByTestId('library-variant-form.button-outline').textContent).toContain('✓');

    fireEvent.click(screen.getByTestId('library-add-form.button'));
    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });
    const call = spy.mock.calls[0]?.[0];
    expect(call?.kind).toBe('insert');
    if (call?.kind === 'insert') {
      expect(call.jsx).toContain('border');
      expect(call.jsx).not.toContain('bg-blue-600');
    }
  });

  it('Test 4: persists favorite star across remount and shows no Recent row', async () => {
    const project: ProjectInfo = {
      id: 'proj-fav-test',
      name: 'Fav Project',
      root: '/tmp/proj',
      sourceDir: 'src',
      support: {
        supported: true,
        framework: 'vite-react',
        versions: { vite: '6.0.0', react: '19.0.0', tailwindcss: '4.1.0' },
        language: 'ts',
        styling: {
          systems: [{ id: 'tailwind', version: '4.1.0' }],
          editable: true,
          globalCss: ['src/index.css'],
          primary: 'tailwind',
        },
        reasons: [],
      },
      needsInstall: false,
      responsiveMode: 'desktop-first',
      frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
      primaryFrameId: 'desktop',
      backends: [],
      trusted: true,
      designDirs: DEFAULT_DESIGN_DIRS,
    };
    useProjectStore.getState().setProject(project);
    vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/Home.tsx'],
      locs: ['src/Home.tsx:25:5'],
    });
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/Home.tsx:10:1', index: 0 }]);
    useStructureErrorStore.getState().setActiveSource({ loc: 'src/Home.tsx:10:1', tag: 'div' });

    const { unmount } = render(<LibraryPanel />);
    const starBtn = screen.getByTestId('library-fav-form.button');
    fireEvent.click(starBtn);
    expect(screen.getByTestId('library-favorites')).toBeDefined();
    expect(screen.getByTestId('library-fav-item-form.button')).toBeDefined();
    unmount();

    render(<LibraryPanel />);
    expect(screen.getByTestId('library-fav-item-form.button')).toBeDefined();
    expect(screen.getByTestId('library-fav-form.button').getAttribute('aria-pressed')).toBe('true');

    // No "Recent" row (owner, 2026-11-15): inserting a block adds nothing above the Library.
    fireEvent.click(screen.getByTestId('library-add-content.heading'));
    await waitFor(() => {
      expect(sourceClient.applyStructureEdit).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('library-recent')).toBeNull();
  }, 15_000);

  it('Test 5: shows static SVG wireframe previews on hover and focus with zero iframes for every block', () => {
    for (const block of LIBRARY_BLOCKS) {
      expect(hasBlockPreview(block.id)).toBe(true);
    }

    useProjectStore.getState().setProject({
      id: 'proj-preview-test',
      name: 'Preview Project',
      root: '/tmp/proj',
      sourceDir: 'src',
      support: {
        supported: true,
        framework: 'vite-react',
        versions: { vite: '6.0.0', react: '19.0.0', tailwindcss: '4.1.0' },
        language: 'ts',
        styling: {
          systems: [{ id: 'tailwind', version: '4.1.0' }],
          editable: true,
          globalCss: ['src/index.css'],
          primary: 'tailwind',
        },
        reasons: [],
      },
      needsInstall: false,
      responsiveMode: 'desktop-first',
      frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
      primaryFrameId: 'desktop',
      backends: [],
      trusted: true,
      designDirs: DEFAULT_DESIGN_DIRS,
    });
    render(<LibraryPanel />);

    const pricingTile = screen.getByTestId('library-block-landing.pricing');
    fireEvent.mouseEnter(pricingTile);
    const hoverPreview = screen.getByTestId('library-preview-landing.pricing');
    expect(hoverPreview.querySelector('svg')).not.toBeNull();
    expect(hoverPreview.querySelector('iframe')).toBeNull();
    fireEvent.mouseLeave(pricingTile);
    expect(screen.queryByTestId('library-preview-landing.pricing')).toBeNull();

    const modalTile = screen.getByTestId('library-block-interactive.modal');
    fireEvent.focus(modalTile);
    const focusPreview = screen.getByTestId('library-preview-interactive.modal');
    expect(focusPreview.querySelector('svg')).not.toBeNull();
    expect(focusPreview.querySelector('iframe')).toBeNull();
    fireEvent.blur(modalTile);
    expect(screen.queryByTestId('library-preview-interactive.modal')).toBeNull();
  });
});
