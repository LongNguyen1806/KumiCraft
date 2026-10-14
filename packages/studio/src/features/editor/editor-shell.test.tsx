import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { isApplePlatform, shortcutLabel } from '../../app/platform.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { EditorScreen } from '../../routes/editor-screen.tsx';
import { shortcutFor } from './use-editor-shortcuts.ts';
import { clampWidth, readLayout } from './use-panel-layout.ts';

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
});

describe('frame helpers', () => {
  it('uses Ctrl on Windows and Linux, Cmd on macOS', () => {
    const key = (k: string, mods: Partial<KeyboardEvent> = {}) => ({
      key: k,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      ...mods,
    });
    expect(shortcutFor(key('z', { ctrlKey: true }), false)).toBe('undo');
    expect(shortcutFor(key('y', { ctrlKey: true }), false)).toBe('redo');
    expect(shortcutFor(key('\\', { ctrlKey: true }), false)).toBe('togglePanels');
    expect(shortcutFor(key('z', { metaKey: true }), false)).toBeUndefined();

    expect(shortcutFor(key('z', { metaKey: true }), true)).toBe('undo');
    expect(shortcutFor(key('Z', { metaKey: true, shiftKey: true }), true)).toBe('redo');
    expect(shortcutFor(key('z', { ctrlKey: true }), true)).toBeUndefined();
  });

  it('leaves the keys the browser keeps on macOS alone (back, forward, history) [R-KB-13]', () => {
    const cmd = (k: string) => ({
      key: k,
      ctrlKey: false,
      metaKey: true,
      shiftKey: false,
      altKey: false,
    });

    expect([
      shortcutFor(cmd('['), true),
      shortcutFor(cmd(']'), true),
      shortcutFor(cmd('y'), true),
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

  it('keeps panel widths between 200 and 480 px and survives broken storage', () => {
    expect([clampWidth(50), clampWidth(300), clampWidth(900)]).toEqual([200, 300, 480]);
    localStorage.setItem('reactcraft.panels', '{ broken');
    expect(readLayout().width).toEqual({ left: 268, right: 308 });
  });
});
