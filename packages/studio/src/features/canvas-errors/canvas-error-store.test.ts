// Unit tests for Canvas error store (SPEC-04 M-RN, R-RN-25).
import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_RUNTIME_ERRORS, useCanvasErrorStore } from './canvas-error-store.ts';

describe('useCanvasErrorStore [R-RN-25]', () => {
  beforeEach(() => {
    useCanvasErrorStore.getState().reset();
  });

  it('aggregates same message twice into 1 entry with count 2 and latest stack [R-RN-25]', () => {
    const store = useCanvasErrorStore.getState();
    store.addRuntimeError({ message: 'Error 1', stack: 'stack v1' });
    store.addRuntimeError({ message: 'Error 1', stack: 'stack v2' });

    const errors = useCanvasErrorStore.getState().runtimeErrors;
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message: 'Error 1',
      stack: 'stack v2',
      count: 2,
    });
  });

  it('re-orders recurring message to the top with incremented count [R-RN-25]', () => {
    const store = useCanvasErrorStore.getState();
    store.addRuntimeError({ message: 'Error A' });
    store.addRuntimeError({ message: 'Error B' });
    store.addRuntimeError({ message: 'Error A' });

    const errors = useCanvasErrorStore.getState().runtimeErrors;
    expect(errors).toHaveLength(2);
    expect(errors[0]?.message).toBe('Error A');
    expect(errors[0]?.count).toBe(2);
    expect(errors[1]?.message).toBe('Error B');
    expect(errors[1]?.count).toBe(1);
  });

  it('keeps at most MAX_RUNTIME_ERRORS entries dropping oldest [R-RN-25]', () => {
    const store = useCanvasErrorStore.getState();
    for (let i = 1; i <= 6; i++) {
      store.addRuntimeError({ message: `Error ${String(i)}` });
    }

    const errors = useCanvasErrorStore.getState().runtimeErrors;
    expect(errors).toHaveLength(MAX_RUNTIME_ERRORS);
    expect(errors.map((e) => e.message)).toEqual([
      'Error 6',
      'Error 5',
      'Error 4',
      'Error 3',
      'Error 2',
    ]);
  });

  it('sets and clears build error properly [R-RN-25]', () => {
    const store = useCanvasErrorStore.getState();
    store.setBuildError({
      message: 'Failed to compile',
      file: 'src/App.tsx',
      line: 10,
      column: 2,
    });

    expect(useCanvasErrorStore.getState().buildError).toEqual({
      message: 'Failed to compile',
      file: 'src/App.tsx',
      line: 10,
      column: 2,
    });

    store.clearBuildError();
    expect(useCanvasErrorStore.getState().buildError).toBeUndefined();
  });

  it('resets both build error and runtime errors [R-RN-25]', () => {
    const store = useCanvasErrorStore.getState();
    store.setBuildError({ message: 'Build failed' });
    store.addRuntimeError({ message: 'Runtime crash' });

    expect(useCanvasErrorStore.getState().buildError).toBeDefined();
    expect(useCanvasErrorStore.getState().runtimeErrors).toHaveLength(1);

    store.reset();
    expect(useCanvasErrorStore.getState().buildError).toBeUndefined();
    expect(useCanvasErrorStore.getState().runtimeErrors).toHaveLength(0);
  });
});
