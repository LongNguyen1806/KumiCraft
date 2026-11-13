import { LIBRARY_BLOCKS, type ProjectInfo, type TreeNode } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { useDesignStore } from '../design/design-store.ts';
import { DEFAULT_THEME, useThemeStore } from '../inspector/use-project-theme.ts';
import { useProjectStore } from '../project/project-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { insertBlock, resetThemeLookAttempt } from './insert-block.ts';

function makeProject(
  primary: 'bootstrap' | 'sass',
  systems: { id: 'bootstrap' | 'sass'; version?: string }[],
): ProjectInfo {
  return {
    id: 'proj000018',
    name: 'Test Project',
    root: '/test',
    sourceDir: 'src',
    support: {
      supported: true,
      reasons: [],
      framework: 'vite-react',
      versions: {},
      language: 'ts',
      styling: {
        systems,
        primary,
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
      pages: ['src/pages'],
      layouts: ['src/layouts'],
      components: ['src/components'],
      drafts: 'src/drafts',
    },
    trusted: true,
  };
}

describe('insertBlock (Scenario #13) [R-CP-11]', () => {
  const homeMainRef = { loc: 'src/pages/Home.tsx:20:7', index: 0 };
  const layoutDivRef = { loc: 'src/layouts/MainLayout.tsx:10:5', index: 0 };
  const headerRef = { loc: 'src/components/Header.tsx:5:3', index: 0 };

  const treeNodes: readonly TreeNode[] = [
    {
      ref: homeMainRef,
      tag: 'main',
      instances: 1,
    },
    {
      ref: layoutDivRef,
      parent: 0,
      tag: 'div',
      instances: 1,
    },
    {
      ref: headerRef,
      parent: 1,
      tag: 'header',
      instances: 1,
    },
  ];

  beforeEach(() => {
    resetThemeLookAttempt();
    useThemeStore.setState({
      theme: { ...DEFAULT_THEME, file: 'src/index.css' },
    });
    useSelectionStore.getState().reset();
    useDesignStore.getState().setTarget(undefined);
    useProjectStore.getState().setProject(undefined);
  });

  afterEach(() => {
    useProjectStore.getState().setProject(undefined);
    vi.restoreAllMocks();
  });

  it('inserts into main of Home when selected element belongs to Header.tsx (scenario 13)', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/pages/Home.tsx'],
      locs: ['src/pages/Home.tsx:35:5'],
    });

    useDesignStore.getState().setTarget({
      kind: 'page',
      name: 'Home',
      file: 'src/pages/Home.tsx',
      route: '/',
    });
    useSelectionStore.getState().setTree([...treeNodes]);
    useSelectionStore.getState().setSelectedRefs([headerRef]);

    const paragraphBlock = LIBRARY_BLOCKS.find((b) => b.id === 'content.paragraph');
    if (!paragraphBlock) throw new Error('Missing paragraph block');

    const result = await insertBlock(paragraphBlock, 'vi');

    expect(result.ok).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'insert',
        target: {
          kind: 'child',
          parent: { loc: homeMainRef.loc, tag: 'main' },
          where: 'end',
        },
      }),
    );
  });

  it('18. [R-ST-12] bootstrap5 project sends Bootstrap JSX without css, and sass project sends css.rules', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/pages/Home.tsx'],
      locs: ['src/pages/Home.tsx:35:5'],
    });

    useSelectionStore.getState().setTree([...treeNodes]);
    useSelectionStore.getState().setSelectedRefs([homeMainRef]);

    const cardBlock = LIBRARY_BLOCKS.find((b) => b.id === 'composite.card');
    if (!cardBlock) throw new Error('Missing composite.card block');

    useProjectStore
      .getState()
      .setProject(makeProject('bootstrap', [{ id: 'bootstrap', version: '5.3.0' }]));
    const bootRes = await insertBlock(cardBlock, 'vi');
    expect(bootRes.ok).toBe(true);
    const bootCall = spy.mock.calls[0]?.[0];
    expect(bootCall?.kind).toBe('insert');
    if (bootCall?.kind === 'insert') {
      expect(bootCall.jsx).toContain('className="card card-body"');
      expect(bootCall.jsx).toContain('className="btn btn-primary"');
      expect(bootCall.css).toBeUndefined();
    }

    spy.mockClear();
    useSelectionStore.getState().setSelectedRefs([homeMainRef]);
    useProjectStore.getState().setProject(makeProject('sass', [{ id: 'sass' }]));

    const sassRes = await insertBlock(cardBlock, 'vi');
    expect(sassRes.ok).toBe(true);
    const sassCall = spy.mock.calls[0]?.[0];
    expect(sassCall?.kind).toBe('insert');
    if (sassCall?.kind === 'insert') {
      expect(sassCall.jsx).toContain('className="kc-card"');
      expect(sassCall.css?.rules.length).toBeGreaterThan(0);
      expect(sassCall.css?.rules.some((r) => r.selector === '.kc-card')).toBe(true);
    }
  });

  it('12. [TK-43] applies brand token from theme, loads theme once when unloaded, and falls back to defaults on load error', async () => {
    const editSpy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/pages/Home.tsx'],
      locs: ['src/pages/Home.tsx:35:5'],
    });
    const buttonBlock = LIBRARY_BLOCKS.find((b) => b.id === 'form.button');
    if (!buttonBlock) throw new Error('Missing form.button block');

    useSelectionStore.getState().setTree([...treeNodes]);
    useSelectionStore.getState().setSelectedRefs([homeMainRef]);

    // (a) Theme already loaded with brand token: uses bg-brand without calling load()
    const loadSpy = vi.spyOn(useThemeStore.getState(), 'load');
    useThemeStore.getState().setTheme({
      ...DEFAULT_THEME,
      file: 'src/index.css',
      colors: [{ name: 'brand', value: '#3b82f6' }],
    });

    const loadedRes = await insertBlock(buttonBlock, 'en');
    expect(loadedRes.ok).toBe(true);
    expect(loadSpy).not.toHaveBeenCalled();
    const loadedCall = editSpy.mock.calls[0]?.[0];
    expect(loadedCall?.kind).toBe('insert');
    if (loadedCall?.kind === 'insert') {
      expect(loadedCall.jsx).toContain('bg-brand');
    }

    // (b) Theme not loaded yet: load() is called once, then subsequent insert does not reload
    editSpy.mockClear();
    loadSpy.mockClear();
    resetThemeLookAttempt();
    useThemeStore.getState().setTheme(DEFAULT_THEME);
    useSelectionStore.getState().setSelectedRefs([homeMainRef]);
    loadSpy.mockImplementation(() => {
      useThemeStore.getState().setTheme({
        ...DEFAULT_THEME,
        file: 'src/index.css',
        colors: [{ name: 'brand', value: '#3b82f6' }],
      });
      return Promise.resolve();
    });

    await insertBlock(buttonBlock, 'en');
    expect(loadSpy).toHaveBeenCalledTimes(1);
    const afterLoadCall = editSpy.mock.calls[0]?.[0];
    if (afterLoadCall?.kind === 'insert') {
      expect(afterLoadCall.jsx).toContain('bg-brand');
    }

    useSelectionStore.getState().setSelectedRefs([homeMainRef]);
    await insertBlock(buttonBlock, 'en');
    expect(loadSpy).toHaveBeenCalledTimes(1);

    // (c) Theme load throws: still inserts using default blue-600
    editSpy.mockClear();
    loadSpy.mockClear();
    resetThemeLookAttempt();
    useThemeStore.getState().setTheme(DEFAULT_THEME);
    useSelectionStore.getState().setSelectedRefs([homeMainRef]);
    loadSpy.mockRejectedValueOnce(new Error('network error'));

    const errRes = await insertBlock(buttonBlock, 'en');
    expect(errRes.ok).toBe(true);
    expect(loadSpy).toHaveBeenCalledTimes(1);
    const fallbackCall = editSpy.mock.calls[0]?.[0];
    expect(fallbackCall?.kind).toBe('insert');
    if (fallbackCall?.kind === 'insert') {
      expect(fallbackCall.jsx).toContain('bg-blue-600');
    }
  });
});
