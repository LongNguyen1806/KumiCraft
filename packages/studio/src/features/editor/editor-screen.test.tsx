import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { isApplePlatform, shortcutLabel } from '../../app/platform.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { EditorScreen } from '../../routes/editor-screen.tsx';
import { useEditorStore } from '../../store/editor-store.ts';
import { sampleDocument, setText, stubApi } from '../../store/test-support.ts';
import { shortcutFor } from './use-editor-shortcuts.ts';
import { clampWidth, readLayout } from './use-panel-layout.ts';

const press = (key: string, extra: Partial<KeyboardEventInit> = {}) => {
  fireEvent.keyDown(window, { key, ctrlKey: true, ...extra });
};

/** The layer row showing `text`. */
const layerRow = (text: string): HTMLElement => {
  const row = screen.getByText(text).closest('button') ?? undefined;
  if (row === undefined) throw new Error(`no layer row for ${text}`);
  return row;
};

const openEditor = async () => {
  stubApi({ 'workspace/document': { document: sampleDocument(4), revision: 4 } });
  render(<EditorScreen />);
  await screen.findByTestId('frame');
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
  vi.unstubAllGlobals();
});

describe('Editor frame', () => {
  it('opens on the primary frame of the first page, saved, at the server revision', async () => {
    await openEditor();

    expect(screen.getByTestId('frame-size').textContent).toBe('1440 × 900');
    expect(screen.getByTestId('page-picker')).toHaveProperty('value', 'p_home000001');
    expect(screen.getByTestId('sync-status').textContent).toBe('Saved');
    expect(screen.getByText('revision 4')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' })).toHaveProperty('disabled', true);
  });

  it('switches frame and page', async () => {
    await openEditor();

    fireEvent.click(screen.getByRole('button', { name: /Mobile/ }));
    fireEvent.change(screen.getByTestId('page-picker'), { target: { value: 'p_about00001' } });

    expect(screen.getByTestId('frame-size').textContent).toBe('375 × 812');
    expect(screen.getAllByTestId('layer-list')[0]?.textContent).toBe('Stack');
  });

  it('selects a layer and shows its path in the status bar [R-SH-03]', async () => {
    await openEditor();

    fireEvent.click(layerRow('Original text'));

    expect(screen.getByTestId('breadcrumb').textContent).toBe('Stack›Card›Text');
    expect(screen.getByTestId('selected-id').textContent).toBe('n_text000001');
  });

  it('hides and shows the panels with buttons and shortcuts, remembering it [R-SH-01]', async () => {
    await openEditor();

    fireEvent.click(screen.getByRole('button', { name: /Show or hide the left panel/ }));
    expect(screen.queryByRole('complementary', { name: 'Layers and library' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Show or hide the right panel/ }));
    expect(screen.queryByRole('complementary', { name: 'Properties' })).toBeNull();
    expect(readLayout().visible).toEqual({ left: false, right: false });
    press('\\');
    expect(screen.getAllByRole('complementary')).toHaveLength(2);
    press('\\');
    expect(screen.queryAllByRole('complementary')).toHaveLength(0);
  });

  it('undoes with Ctrl+Z and redoes with Ctrl+Y', async () => {
    await openEditor();
    act(() => {
      useEditorStore.getState().dispatch([setText('Changed')], { source: 'user', label: 'Edit' });
    });
    expect(layerRow('Changed')).toBeDefined();

    act(() => {
      press('z');
    });
    expect(layerRow('Original text')).toBeDefined();
    act(() => {
      press('y');
    });
    expect(layerRow('Changed')).toBeDefined();
  });

  it('asks before closing the tab while edits are unsaved [R-HS-03]', async () => {
    await openEditor();
    act(() => {
      useEditorStore.getState().dispatch([setText('Unsaved')], { source: 'user', label: 'Edit' });
    });

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('shows the error and a retry when the document cannot be loaded', async () => {
    stubApi({});
    render(<EditorScreen />);

    expect((await screen.findByRole('alert')).textContent).toContain('(E015)');
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

  it('leaves the keys the browser keeps on macOS alone (back, forward, history)', () => {
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
