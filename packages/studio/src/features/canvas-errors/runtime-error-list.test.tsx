// Unit tests for RuntimeErrorList (SPEC-04 M-RN, R-RN-25).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { useCanvasErrorStore } from './canvas-error-store.ts';
import { RuntimeErrorList } from './runtime-error-list.tsx';

beforeAll(async () => {
  await initI18n();
});

describe('RuntimeErrorList [R-RN-25]', () => {
  beforeEach(() => {
    useCanvasErrorStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders multiple errors and count badge when count > 1 [R-RN-25]', () => {
    const store = useCanvasErrorStore.getState();
    store.addRuntimeError({ message: 'TypeError: cannot read property of undefined' });
    store.addRuntimeError({ message: 'TypeError: cannot read property of undefined' });
    store.addRuntimeError({ message: 'TypeError: cannot read property of undefined' });
    store.addRuntimeError({ message: 'ReferenceError: foo is not defined' });

    render(<RuntimeErrorList />);

    const items = screen.getAllByTestId('canvas-runtime-error-item');
    expect(items).toHaveLength(2);

    const countBadge = screen.getByTestId('canvas-runtime-error-count');
    expect(countBadge.textContent).toBe('×3');
  });

  it('dismisses runtime error list when dismiss button is clicked [R-RN-25]', () => {
    const store = useCanvasErrorStore.getState();
    store.addRuntimeError({ message: 'Uncaught error' });

    render(<RuntimeErrorList />);
    expect(screen.getByTestId('canvas-runtime-errors')).toBeDefined();

    const dismissBtn = screen.getByTestId('canvas-runtime-errors-dismiss');
    fireEvent.click(dismissBtn);

    expect(screen.queryByTestId('canvas-runtime-errors')).toBeNull();
  });

  it('renders nothing when runtimeErrors is empty [R-RN-25]', () => {
    const { container } = render(<RuntimeErrorList />);
    expect(container.firstChild).toBeNull();
  });
});
