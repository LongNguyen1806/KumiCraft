// History client reads the real server answers (R-HI-01, R-HI-02).
import type { HistoryStep } from '@kumicraft/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { redoHistory, undoHistory } from './history-client.ts';
import * as http from './http.ts';

const label = { key: 'history:setClassName', params: { tag: 'h1' } };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('history client [R-HI-01]', () => {
  it('keeps the remaining undo steps from the { state, files } answer of an undo', async () => {
    const step: HistoryStep = {
      state: { undo: label, redo: label, undoCount: 2, redoCount: 1 },
      files: ['src/pages/Home.tsx'],
    };
    vi.spyOn(http, 'apiPost').mockResolvedValue(step);

    expect(await undoHistory()).toEqual(step.state);
  });

  it('keeps the remaining redo steps from the { state, files } answer of a redo', async () => {
    const step: HistoryStep = {
      state: { undo: label, redo: label, undoCount: 3, redoCount: 1 },
      files: ['src/pages/Home.tsx'],
    };
    vi.spyOn(http, 'apiPost').mockResolvedValue(step);

    expect(await redoHistory()).toEqual(step.state);
  });
});
