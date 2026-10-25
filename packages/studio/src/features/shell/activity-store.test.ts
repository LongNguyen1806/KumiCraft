import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePanelLayoutStore } from '../editor/use-panel-layout.ts';
import {
  activate,
  ACTIVITY_KEY,
  OLD_LEFT_PANEL_KEY,
  OLD_RIGHT_PANEL_KEY,
  useActivityStore,
} from './activity-store.ts';

describe('Activity Store [WP-4.00]', () => {
  beforeEach(() => {
    localStorage.clear();
    useActivityStore.getState().initFromStorage();
    // Reset left panel to visible
    usePanelLayoutStore.getState().show('left');
  });

  it('Test 1: defaults to layers, setActive("brand") saves kumicraft.activity, handles storage error [WP-4.00]', () => {
    expect(useActivityStore.getState().active).toBe('layers');

    useActivityStore.getState().setActive('brand');
    expect(useActivityStore.getState().active).toBe('brand');
    expect(localStorage.getItem(ACTIVITY_KEY) ?? undefined).toBe('brand');

    // Storage throw error check
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => {
      useActivityStore.getState().setActive('pages');
    }).not.toThrow();
    expect(useActivityStore.getState().active).toBe('pages');
    setItemSpy.mockRestore();
  });

  it('Test 2: performs one-time migration from legacy tabs and removes old keys [WP-4.00]', () => {
    // Legacy leftPanelTab = library
    localStorage.clear();
    localStorage.setItem(OLD_LEFT_PANEL_KEY, 'library');
    useActivityStore.getState().initFromStorage();
    expect(useActivityStore.getState().active).toBe('library');
    expect(localStorage.getItem(OLD_LEFT_PANEL_KEY) ?? undefined).toBeUndefined();
    expect(localStorage.getItem(OLD_RIGHT_PANEL_KEY) ?? undefined).toBeUndefined();
    expect(localStorage.getItem(ACTIVITY_KEY) ?? undefined).toBe('library');

    // Legacy rightPanelTab = brand takes precedence
    localStorage.clear();
    localStorage.setItem(OLD_LEFT_PANEL_KEY, 'components');
    localStorage.setItem(OLD_RIGHT_PANEL_KEY, 'brand');
    useActivityStore.getState().initFromStorage();
    expect(useActivityStore.getState().active).toBe('brand');
    expect(localStorage.getItem(OLD_LEFT_PANEL_KEY) ?? undefined).toBeUndefined();
    expect(localStorage.getItem(OLD_RIGHT_PANEL_KEY) ?? undefined).toBeUndefined();
    expect(localStorage.getItem(ACTIVITY_KEY) ?? undefined).toBe('brand');
  });

  it('keeps the right panel tab it still uses, and migrates only once [WP-4.00]', () => {
    localStorage.clear();
    localStorage.setItem(OLD_RIGHT_PANEL_KEY, 'chat');
    useActivityStore.getState().initFromStorage();
    expect(useActivityStore.getState().active).toBe('layers');
    expect(localStorage.getItem(OLD_RIGHT_PANEL_KEY) ?? undefined).toBe('chat');
    expect(localStorage.getItem(ACTIVITY_KEY) ?? undefined).toBe('layers');

    // The right panel saves its tab again; the next load leaves both keys alone.
    useActivityStore.getState().setActive('pages');
    useActivityStore.getState().initFromStorage();
    expect(useActivityStore.getState().active).toBe('pages');
    expect(localStorage.getItem(OLD_RIGHT_PANEL_KEY) ?? undefined).toBe('chat');
  });

  it('Test 3: activate(id) switches item and opens panel when different; collapses panel when same [WP-4.00]', () => {
    useActivityStore.getState().setActive('layers');
    usePanelLayoutStore.getState().show('left');
    expect(usePanelLayoutStore.getState().layout.visible.left).toBe(true);

    // Activating a different id switches active and keeps panel open
    activate('library');
    expect(useActivityStore.getState().active).toBe('library');
    expect(usePanelLayoutStore.getState().layout.visible.left).toBe(true);

    // Activating the same id collapses left panel
    activate('library');
    expect(usePanelLayoutStore.getState().layout.visible.left).toBe(false);
  });

  it('Test 4: activate("library") opens left panel and sets active when panel was collapsed [WP-4.00]', () => {
    useActivityStore.getState().setActive('layers');
    usePanelLayoutStore.getState().show('left');

    // Collapse left panel via toggle
    usePanelLayoutStore.getState().toggle('left');
    expect(usePanelLayoutStore.getState().layout.visible.left).toBe(false);

    // Calling activate on another item opens left panel
    activate('library');
    expect(useActivityStore.getState().active).toBe('library');
    expect(usePanelLayoutStore.getState().layout.visible.left).toBe(true);

    // Collapse again
    usePanelLayoutStore.getState().toggle('left');
    expect(usePanelLayoutStore.getState().layout.visible.left).toBe(false);

    // Calling activate on the SAME item that is currently active also opens left panel
    activate('library');
    expect(useActivityStore.getState().active).toBe('library');
    expect(usePanelLayoutStore.getState().layout.visible.left).toBe(true);
  });
});
