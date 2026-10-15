import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as historyClient from '../../api/history-client.ts';
import { ApiError } from '../../api/http.ts';
import { useHistoryStore } from './history-store.ts';

vi.mock('../../api/history-client.ts', () => ({
  fetchHistoryState: vi.fn(),
  undoHistory: vi.fn(),
  redoHistory: vi.fn(),
}));

describe('HistoryStore', () => {
  beforeEach(() => {
    useHistoryStore.getState().reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with default empty state', () => {
    const state = useHistoryStore.getState();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.undoCount).toBe(0);
    expect(state.redoCount).toBe(0);
    expect(state.undoLabel).toBeUndefined();
    expect(state.redoLabel).toBeUndefined();
    expect(state.isApplying).toBe(false);
    expect(state.error).toBeUndefined();
  });

  it('loads history state from server', async () => {
    vi.mocked(historyClient.fetchHistoryState).mockResolvedValueOnce({
      undoCount: 2,
      redoCount: 0,
      undo: { key: 'history:setClassName' },
    });

    await useHistoryStore.getState().load();

    const state = useHistoryStore.getState();
    expect(state.canUndo).toBe(true);
    expect(state.canRedo).toBe(false);
    expect(state.undoCount).toBe(2);
    expect(state.undoLabel?.key).toBe('history:setClassName');
  });

  it('applies state directly via applyState', () => {
    useHistoryStore.getState().applyState({
      undoCount: 3,
      redoCount: 1,
      undo: { key: 'history:setText' },
      redo: { key: 'history:setClassName' },
    });

    const state = useHistoryStore.getState();
    expect(state.canUndo).toBe(true);
    expect(state.canRedo).toBe(true);
    expect(state.undoCount).toBe(3);
    expect(state.redoCount).toBe(1);
    expect(state.undoLabel?.key).toBe('history:setText');
    expect(state.redoLabel?.key).toBe('history:setClassName');
  });

  it('executes undo when canUndo is true', async () => {
    useHistoryStore.getState().applyState({
      undoCount: 1,
      redoCount: 0,
      undo: { key: 'history:setClassName' },
    });

    vi.mocked(historyClient.undoHistory).mockResolvedValueOnce({
      undoCount: 0,
      redoCount: 1,
      redo: { key: 'history:setClassName' },
    });

    await useHistoryStore.getState().undo();

    expect(historyClient.undoHistory).toHaveBeenCalledTimes(1);
    const state = useHistoryStore.getState();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(true);
    expect(state.isApplying).toBe(false);
  });

  it('does nothing on undo when canUndo is false', async () => {
    await useHistoryStore.getState().undo();
    expect(historyClient.undoHistory).not.toHaveBeenCalled();
  });

  it('executes redo when canRedo is true', async () => {
    useHistoryStore.getState().applyState({
      undoCount: 0,
      redoCount: 1,
      redo: { key: 'history:setClassName' },
    });

    vi.mocked(historyClient.redoHistory).mockResolvedValueOnce({
      undoCount: 1,
      redoCount: 0,
      undo: { key: 'history:setClassName' },
    });

    await useHistoryStore.getState().redo();

    expect(historyClient.redoHistory).toHaveBeenCalledTimes(1);
    const state = useHistoryStore.getState();
    expect(state.canUndo).toBe(true);
    expect(state.canRedo).toBe(false);
  });

  it('captures E017 error with file details on undo failure', async () => {
    useHistoryStore.getState().applyState({
      undoCount: 1,
      redoCount: 0,
    });

    const error = new ApiError(409, 'E017', {
      file: 'src/Button.tsx',
      reason: 'fileChanged',
    });
    vi.mocked(historyClient.undoHistory).mockRejectedValueOnce(error);

    await useHistoryStore.getState().undo();

    const state = useHistoryStore.getState();
    expect(state.isApplying).toBe(false);
    expect(state.error?.code).toBe('E017');
    expect(state.error?.file).toBe('src/Button.tsx');
    expect(state.error?.message).toContain('src/Button.tsx');

    state.clearError();
    expect(useHistoryStore.getState().error).toBeUndefined();
  });
});
