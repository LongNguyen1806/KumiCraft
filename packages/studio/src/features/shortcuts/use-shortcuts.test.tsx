// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { studioBridgeChannel } from '../../core/bridge-channel.ts';
import { useCanvasViewStore } from '../../core/canvas-view-store.ts';
import { useSelectionStore } from '../../core/selection-store.ts';
import { useDesignStore } from '../design/design-store.ts';
import { useStructureErrorStore } from '../structure/structure-error-store.ts';
import { useShortcuts } from './use-shortcuts.ts';

function ShortcutHarness() {
  useShortcuts();
  return <div data-testid="harness" />;
}

describe('Studio useShortcuts (Scenarios #4, #5, #8, #9, #10)', () => {
  beforeEach(() => {
    useSelectionStore.getState().reset();
    useStructureErrorStore.getState().clearError();
    useStructureErrorStore.getState().setActiveSource(undefined);
    useCanvasViewStore.setState({
      mode: 'design',
      zoom: 'fit',
      displayedZoom: 1,
      activeFrameId: 'desktop',
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useDesignStore.getState().setTarget(undefined);
    useDesignStore.getState().exitComponentMode();
  });

  it('Scenario 4: Delete in typing input does not trigger remove; Alt+P still toggles preview', () => {
    render(<ShortcutHarness />);
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit');
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/Home.tsx:10:5', index: 0 }]);
    useStructureErrorStore.getState().setActiveSource({ loc: 'src/Home.tsx:10:5', tag: 'div' });

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // 1. Delete while focused in input
    const deleteEvt = new KeyboardEvent('keydown', {
      key: 'Delete',
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(deleteEvt);

    expect(deleteEvt.defaultPrevented).toBe(false);
    expect(spy).not.toHaveBeenCalled();

    // 2. Alt+P while focused in input (WORKS_WHILE_TYPING)
    expect(useCanvasViewStore.getState().mode).toBe('design');
    const altPEvt = new KeyboardEvent('keydown', {
      key: 'p',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(altPEvt);

    expect(altPEvt.defaultPrevented).toBe(true);
    expect(useCanvasViewStore.getState().mode).toBe('preview');

    input.remove();
  });

  it('arrows nudge only with no Studio control focused; a focused button keeps its arrows [R-FF-15]', () => {
    render(<ShortcutHarness />);
    const batchSpy = vi.spyOn(sourceClient, 'editSourceBatch');
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();

    const onButton = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    button.dispatchEvent(onButton);
    expect(onButton.defaultPrevented).toBe(false);

    button.remove();
    const onBody = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(onBody);
    expect(onBody.defaultPrevented).toBe(true);
    expect(batchSpy).not.toHaveBeenCalled(); // nothing selected: nothing to nudge
  });

  it('Scenario 5: Ctrl+D when nothing is selected does not call API and does not preventDefault', () => {
    render(<ShortcutHarness />);
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit');
    useSelectionStore.getState().setSelectedRefs([]);

    const event = new KeyboardEvent('keydown', {
      key: 'd',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('Scenario 8: Ctrl+↑ with element having previous sibling calls move with sibling before target', () => {
    render(<ShortcutHarness />);
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/Home.tsx'],
      locs: ['src/Home.tsx:5:5'],
    });

    const n1 = {
      tag: 'h1',
      instances: 1,
      ref: { loc: 'src/Home.tsx:5:5', index: 0 },
      parent: 0,
    };
    const n2 = {
      tag: 'div',
      instances: 1,
      ref: { loc: 'src/Home.tsx:10:5', index: 0 },
      parent: 0,
    };
    useSelectionStore.getState().setTree([n1, n2]);
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/Home.tsx:10:5', index: 0 }]);
    useStructureErrorStore.getState().setActiveSource({ loc: 'src/Home.tsx:10:5', tag: 'div' });

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(spy).toHaveBeenCalledWith({
      kind: 'move',
      elements: [{ loc: 'src/Home.tsx:10:5', tag: 'div' }],
      target: {
        kind: 'sibling',
        ref: { loc: 'src/Home.tsx:5:5', tag: 'h1' },
        where: 'before',
      },
    });
  });

  it('Scenario 9: Esc with element having parent in treeNodes updates selectedRefs to parent', () => {
    render(<ShortcutHarness />);
    const parentNode = {
      tag: 'section',
      instances: 1,
      ref: { loc: 'src/Home.tsx:2:1', index: 0 },
    };
    const childNode = {
      tag: 'div',
      instances: 1,
      ref: { loc: 'src/Home.tsx:10:5', index: 0 },
      parent: 0,
    };
    useSelectionStore.getState().setTree([parentNode, childNode]);
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/Home.tsx:10:5', index: 0 }]);

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(useSelectionStore.getState().selectedRefs).toEqual([
      { loc: 'src/Home.tsx:2:1', index: 0 },
    ]);
  });

  it('Scenario 10: Ctrl+= when zoom is fit with displayedZoom 0.8 zooms to 1; Shift+0 resets; 3 selects 3rd frame', () => {
    render(<ShortcutHarness />);
    useCanvasViewStore.setState({
      zoom: 'fit',
      displayedZoom: 0.8,
      frames: [
        { id: 'frame-1', label: 'Frame 1', width: 320, height: 480 },
        { id: 'frame-2', label: 'Frame 2', width: 768, height: 1024 },
        { id: 'frame-3', label: 'Frame 3', width: 1280, height: 800 },
      ],
      activeFrameId: 'frame-1',
    });

    // 1. Ctrl+= from 0.8 (fit) zooms to next step > 0.8, which is 1
    const zoomInEvt = new KeyboardEvent('keydown', {
      key: '=',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(zoomInEvt);
    expect(zoomInEvt.defaultPrevented).toBe(true);
    expect(useCanvasViewStore.getState().zoom).toBe(1);

    // 2. Shift+0 resets zoom to 1
    useCanvasViewStore.setState({ zoom: 1.5 });
    const resetEvt = new KeyboardEvent('keydown', {
      key: '0',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(resetEvt);
    expect(resetEvt.defaultPrevented).toBe(true);
    expect(useCanvasViewStore.getState().zoom).toBe(1);

    // 3. '3' selects the 3rd frame
    const frame3Evt = new KeyboardEvent('keydown', {
      key: '3',
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(frame3Evt);
    expect(frame3Evt.defaultPrevented).toBe(true);
    expect(useCanvasViewStore.getState().activeFrameId).toBe('frame-3');
  });

  it('Scenario 13: Esc when nothing selected exits componentMode and sends design-file focus: false [R-CP-15]', () => {
    const bridgeSpy = vi.spyOn(studioBridgeChannel, 'setDesignFile');
    useDesignStore.getState().setTarget({
      kind: 'page',
      name: 'Home',
      file: 'src/pages/Home.tsx',
      route: '/',
    });
    useDesignStore.getState().enterComponentMode({
      componentName: 'Header',
      filePath: 'src/components/Header.tsx',
    });
    expect(useDesignStore.getState().componentMode).toBeDefined();

    render(<ShortcutHarness />);

    // Press Escape with no selection
    const escEvt = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(escEvt);

    expect(escEvt.defaultPrevented).toBe(true);
    expect(useDesignStore.getState().componentMode).toBeUndefined();
    expect(bridgeSpy).toHaveBeenLastCalledWith('src/pages/Home.tsx', false);
  });
});
