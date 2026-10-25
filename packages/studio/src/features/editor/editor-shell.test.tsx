import { matchShortcut } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { isApplePlatform, shortcutLabel } from '../../app/platform.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { EditorScreen } from '../../routes/editor-screen.tsx';
import { useHistoryStore } from '../history/history-store.ts';
import { clampWidth, readLayout, usePanelLayoutStore } from './use-panel-layout.ts';

vi.mock('./use-runner-status.ts', () => ({
  useRunnerStatus: () => ({
    status: { state: 'stopped' },
    logTail: [],
    start: vi.fn(),
    restart: vi.fn(),
  }),
}));

vi.mock('../../api/project-client.ts', () => ({
  fetchProject: vi.fn().mockResolvedValue({
    id: 'shop000001',
    name: 'Shop',
    root: '/projects/shop',
    sourceDir: 'src',
    support: {
      supported: true,
      reasons: [],
      framework: 'vite-react',
      versions: {},
      language: 'ts',
    },
    needsInstall: false,
    responsiveMode: 'desktop-first',
    frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
    primaryFrameId: 'desktop',
    backends: [],
    trusted: true,
  }),
  installProject: vi.fn().mockResolvedValue(undefined),
  probeProject: vi.fn().mockResolvedValue({ kind: 'empty' }),
  openProject: vi.fn().mockResolvedValue({}),
  createProject: vi.fn().mockResolvedValue({}),
  closeProject: vi.fn().mockResolvedValue(undefined),
  fetchProjectTheme: vi.fn().mockResolvedValue({
    colors: [],
    fontSizes: [],
    radii: [],
    fonts: [],
    shadows: [],
    breakpoints: [],
  }),
  addProjectBackend: vi.fn().mockResolvedValue({}),
  removeProjectBackend: vi.fn().mockResolvedValue(undefined),
  fetchDirectories: vi.fn().mockResolvedValue({ path: '/', entries: [] }),
}));

const press = (key: string, extra: Partial<KeyboardEventInit> = {}) => {
  fireEvent.keyDown(window, { key, ctrlKey: true, ...extra });
};

const openEditor = () => {
  render(<EditorScreen projectId="shop000001" projectName="Shop" trusted onTrusted={vi.fn()} />);
};

beforeAll(async () => {
  await initI18n();
});

beforeEach(async () => {
  useHistoryStore.getState().reset();
  await i18next.changeLanguage('en');
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('Editor frame', () => {
  it('shows the project name, the Canvas mat and Undo/Redo disabled until history exists', () => {
    openEditor();

    expect(screen.getByTestId('project-name').textContent).toBe('Shop');
    expect(screen.getByTestId('canvas-placeholder')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Redo (Ctrl+Y)' })).toHaveProperty('disabled', true);
  });

  it('hides and shows the panels with buttons and shortcuts, remembering it', () => {
    openEditor();

    fireEvent.click(screen.getByRole('button', { name: /Show or hide the left panel/ }));
    expect(screen.queryByRole('complementary', { name: 'Layers' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Show or hide the right panel/ }));
    expect(screen.queryByRole('complementary', { name: 'Properties' })).toBeNull();
    expect(readLayout().visible).toEqual({ left: false, right: false });
    press('\\');
    expect(screen.getAllByRole('complementary')).toHaveLength(2);
    press('\\');
    expect(screen.queryAllByRole('complementary')).toHaveLength(0);
  });

  it('leaves Ctrl+Z to the browser while there is no history', () => {
    openEditor();
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('enables Undo and Redo and intercepts Ctrl+Z when history exists [R-HI-09]', () => {
    useHistoryStore.getState().applyState({
      undoCount: 1,
      redoCount: 1,
      undo: { key: 'history:setClassName' },
      redo: { key: 'history:setText' },
    });
    const undoSpy = vi.spyOn(useHistoryStore.getState(), 'undo');

    openEditor();

    const undoBtn = screen.getByRole('button', { name: /Undo.*\(Ctrl\+Z\)/ });
    const redoBtn = screen.getByRole('button', { name: /Redo.*\(Ctrl\+Y\)/ });
    expect(undoBtn).toHaveProperty('disabled', false);
    expect(redoBtn).toHaveProperty('disabled', false);

    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(undoSpy).toHaveBeenCalled();
  });

  it('Test 12: collapses left panel while activity bar remains visible and first grid column is 48px [WP-4.00]', () => {
    usePanelLayoutStore.getState().show('left');
    openEditor();

    expect(screen.getByTestId('activity-layers')).toBeDefined();
    expect(screen.getByRole('complementary', { name: 'Layers' })).toBeDefined();

    // Collapse left panel
    fireEvent.click(screen.getByRole('button', { name: /Show or hide the left panel/ }));
    expect(screen.queryByRole('complementary', { name: 'Layers' })).toBeNull();

    // Activity bar remains visible
    expect(screen.getByTestId('activity-layers')).toBeDefined();

    // Grid starts with 48px
    const grid = screen.getByTestId('activity-layers').closest('.grid');
    expect(grid?.getAttribute('style')).toContain('grid-template-columns: 48px');
  });
});

describe('frame helpers', () => {
  it('uses Ctrl on Windows and Linux, Cmd on macOS', () => {
    const key = (
      k: string,
      mods: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {},
    ) => ({
      key: k,
      ctrl: mods.ctrl ?? false,
      meta: mods.meta ?? false,
      shift: mods.shift ?? false,
      alt: mods.alt ?? false,
    });
    expect(matchShortcut(key('z', { ctrl: true }), false)).toBe('undo');
    expect(matchShortcut(key('y', { ctrl: true }), false)).toBe('redo');
    expect(matchShortcut(key('\\', { ctrl: true }), false)).toBe('togglePanels');
    expect(matchShortcut(key('z', { meta: true }), false)).toBeUndefined();

    expect(matchShortcut(key('z', { meta: true }), true)).toBe('undo');
    expect(matchShortcut(key('Z', { meta: true, shift: true }), true)).toBe('redo');
    expect(matchShortcut(key('z', { ctrl: true }), true)).toBeUndefined();
  });

  it('leaves the keys the browser keeps on macOS alone (back, forward, history) [R-KB-13]', () => {
    const cmd = (k: string) => ({
      key: k,
      ctrl: false,
      meta: true,
      shift: false,
      alt: false,
    });

    expect([
      matchShortcut(cmd('['), true),
      matchShortcut(cmd(']'), true),
      matchShortcut(cmd('y'), true),
    ]).toEqual([undefined, undefined, undefined]);
  });

  it('writes shortcuts the way each system does', () => {
    expect([shortcutLabel('undo', true), shortcutLabel('redo', true)]).toEqual(['⌘Z', '⇧⌘Z']);
    expect([shortcutLabel('undo', false), shortcutLabel('redo', false)]).toEqual([
      'Ctrl+Z',
      'Ctrl+Y',
    ]);
    expect(isApplePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)')).toBe(true);
    expect(isApplePlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
  });

  it('keeps panel widths bounded and survives broken storage', () => {
    expect([clampWidth('left', 50), clampWidth('left', 350), clampWidth('left', 900)]).toEqual([
      300, 350, 480,
    ]);
    expect([clampWidth('right', 50), clampWidth('right', 400), clampWidth('right', 900)]).toEqual([
      360, 400, 480,
    ]);
    localStorage.setItem('kumicraft.panels', '{ broken');
    expect(readLayout().width).toEqual({ left: 300, right: 360 });
  });
});
