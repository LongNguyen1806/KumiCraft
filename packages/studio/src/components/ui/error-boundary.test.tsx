// A part that fails to draw shows a notice, not a blank Studio (spec-log #116).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { ErrorBoundary } from './error-boundary.tsx';

let broken = true;
const DRAWN = 'drawn';

function Fragile() {
  if (broken) throw new Error('cannot read the tree\nat Fragile');
  return <p>{DRAWN}</p>;
}

function Neighbour() {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        setCount(count + 1);
      }}
    >
      {`clicked ${String(count)}`}
    </button>
  );
}

beforeAll(async () => {
  await initI18n();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('shows the notice in place of the broken panel and keeps the others working', () => {
    broken = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <>
        <ErrorBoundary scope="panel">
          <Fragile />
        </ErrorBoundary>
        <Neighbour />
      </>,
    );

    expect(screen.getByTestId('error-boundary-panel').textContent).toContain(
      'cannot read the tree',
    );
    expect(screen.getByTestId('error-boundary-panel').textContent).not.toContain('at Fragile');
    fireEvent.click(screen.getByRole('button', { name: 'clicked 0' }));
    expect(screen.getByRole('button', { name: 'clicked 1' })).toBeDefined();
  });

  it('draws the panel again with Try again once the cause is gone', () => {
    broken = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary scope="panel">
        <Fragile />
      </ErrorBoundary>,
    );
    broken = false;
    fireEvent.click(screen.getByTestId('error-boundary-retry'));
    expect(screen.getByText('drawn')).toBeDefined();
  });
});
