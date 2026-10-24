// @vitest-environment happy-dom
import { type InsertTarget, LIBRARY_BLOCKS } from '@kumicraft/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { localizedBlockJsx } from '../library/insert-block.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { runShortcut } from '../shortcuts/shortcut-actions.ts';
import { handleDrawEnd, useImagePickerStore } from './draw-commands.ts';
import { DrawToolbar } from './draw-toolbar.tsx';

const SAMPLE_TARGET: InsertTarget = {
  kind: 'child',
  parent: { loc: 'src/App.tsx:2:2', tag: 'section' },
  where: 'end',
};

describe('Canvas drawing tools (Scenarios #10..#15) [R-DT-10..R-DT-15]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    useSelectionStore.getState().reset();
    useCanvasViewStore.setState({ mode: 'design', tool: 'select', tailwindMajor: 4 });
    useImagePickerStore.setState({ open: false, pending: undefined });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('[R-DT-10] Scenario 10: DrawToolbar + useCanvasViewStore switches tool to frame and resets to select on preview mode', () => {
    const setToolSpy = vi.spyOn(studioBridgeChannel, 'setTool');

    render(<DrawToolbar />);

    const frameBtn = screen.getByTestId('draw-tool-frame');
    fireEvent.click(frameBtn);

    expect(useCanvasViewStore.getState().tool).toBe('frame');
    expect(setToolSpy).toHaveBeenCalledWith('frame');
    expect(frameBtn.getAttribute('aria-pressed')).toBe('true');

    act(() => {
      useCanvasViewStore.getState().setMode('preview');
    });

    expect(useCanvasViewStore.getState().tool).toBe('select');
    expect(screen.queryByTestId('draw-toolbar')).toBeNull();
  });

  it('[R-DT-11] [R-DT-15] Scenario 11: handleDrawEnd frame in normal container near full width uses w-full h-30 and resets tool to select', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/App.tsx'],
      locs: ['src/App.tsx:8:4'],
    });
    useCanvasViewStore.setState({ tool: 'frame' });

    await handleDrawEnd({
      tool: 'frame',
      target: SAMPLE_TARGET,
      size: { width: 395, height: 120 },
      containerWidth: 400,
    });

    expect(useCanvasViewStore.getState().tool).toBe('select');
    expect(spy).toHaveBeenCalledWith({
      kind: 'insert',
      target: SAMPLE_TARGET,
      jsx: '<div className="w-full h-30 rounded-md bg-slate-100"></div>',
      placement: undefined,
      tailwindMajor: undefined,
    });
    expect(useSelectionStore.getState().selectedRefs).toEqual([
      { loc: 'src/App.tsx:8:4', index: 0 },
    ]);
  });

  it('[R-DT-11] Scenario 12: handleDrawEnd frame in free frame sends base div and free placement', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/App.tsx'],
      locs: ['src/App.tsx:9:4'],
    });
    const placement = {
      kind: 'free' as const,
      left: 40,
      top: 32,
      width: 200,
      height: 96,
    };

    await handleDrawEnd({
      tool: 'frame',
      target: SAMPLE_TARGET,
      size: { width: 200, height: 96 },
      containerWidth: 400,
      placement,
    });

    expect(spy).toHaveBeenCalledWith({
      kind: 'insert',
      target: SAMPLE_TARGET,
      jsx: '<div className="rounded-md bg-slate-100"></div>',
      placement,
      tailwindMajor: 4,
    });
  });

  it('[R-DT-12] Scenario 13: handleDrawEnd text inserts localized paragraph and starts text edit when tree updates', async () => {
    await i18next.changeLanguage('vi');
    const editSpy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/App.tsx'],
      locs: ['src/App.tsx:10:4'],
    });
    const startTextEditSpy = vi.spyOn(studioBridgeChannel, 'startTextEdit');

    await handleDrawEnd({
      tool: 'text',
      target: SAMPLE_TARGET,
      containerWidth: 400,
    });

    const paragraphBlock = LIBRARY_BLOCKS.find((b) => b.id === 'content.paragraph');
    expect(paragraphBlock).toBeDefined();
    if (!paragraphBlock) return;

    expect(editSpy).toHaveBeenCalledWith({
      kind: 'insert',
      target: SAMPLE_TARGET,
      jsx: localizedBlockJsx(paragraphBlock, 'vi'),
      placement: undefined,
      tailwindMajor: undefined,
    });
    expect(startTextEditSpy).not.toHaveBeenCalled();

    useSelectionStore
      .getState()
      .setTree([{ ref: { loc: 'src/App.tsx:10:4', index: 0 }, tag: 'p', instances: 1 }]);

    expect(startTextEditSpy).toHaveBeenCalledTimes(1);
    expect(startTextEditSpy).toHaveBeenCalledWith({ loc: 'src/App.tsx:10:4', index: 0 });
  });

  it('[R-DT-14] [R-DT-15] Scenario 14: handleDrawEnd image opens picker, onPick inserts with w-40 h-auto, onCancel skips edit', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/App.tsx'],
      locs: ['src/App.tsx:12:4'],
    });

    await handleDrawEnd({
      tool: 'image',
      target: SAMPLE_TARGET,
      size: { width: 160, height: 96 },
      containerWidth: 400,
    });

    expect(useImagePickerStore.getState().open).toBe(true);
    expect(useCanvasViewStore.getState().tool).toBe('select');

    await useImagePickerStore.getState().onPick({
      image: { kind: 'existing', src: '/logo.png' },
      alt: 'Logo',
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({
      kind: 'insertImage',
      target: SAMPLE_TARGET,
      image: { kind: 'existing', src: '/logo.png' },
      alt: 'Logo',
      className: 'w-40 h-auto',
      placement: undefined,
      tailwindMajor: undefined,
    });

    spy.mockClear();
    await handleDrawEnd({
      tool: 'image',
      target: SAMPLE_TARGET,
      size: { width: 160, height: 96 },
      containerWidth: 400,
    });
    expect(useImagePickerStore.getState().open).toBe(true);

    useImagePickerStore.getState().onCancel();
    expect(useImagePickerStore.getState().open).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    expect(useCanvasViewStore.getState().tool).toBe('select');
  });

  it('[R-DT-10] Scenario 15: runShortcut toolFrame sets frame tool; first selectParent (Esc) resets tool to select without changing selection; second selects parent', () => {
    useSelectionStore.getState().setTree([
      { ref: { loc: 'src/App.tsx:2:2', index: 0 }, tag: 'section', instances: 1 },
      { ref: { loc: 'src/App.tsx:4:4', index: 0 }, parent: 0, tag: 'div', instances: 1 },
    ]);
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:4:4', index: 0 }]);

    expect(runShortcut('toolFrame')).toBe(true);
    expect(useCanvasViewStore.getState().tool).toBe('frame');

    expect(runShortcut('selectParent')).toBe(true);
    expect(useCanvasViewStore.getState().tool).toBe('select');
    expect(useSelectionStore.getState().selectedRefs).toEqual([
      { loc: 'src/App.tsx:4:4', index: 0 },
    ]);

    expect(runShortcut('selectParent')).toBe(true);
    expect(useSelectionStore.getState().selectedRefs).toEqual([
      { loc: 'src/App.tsx:2:2', index: 0 },
    ]);
  });
});
