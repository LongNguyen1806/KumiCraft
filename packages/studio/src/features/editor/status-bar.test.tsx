import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { useCanvasViewStore } from '../../core/canvas-view-store.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { StatusBar } from './status-bar.tsx';

describe('StatusBar', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders restricted status and zoom without canvas controls when untrusted [S-81]', () => {
    render(<StatusBar trusted={false} />);

    expect(screen.getByTestId('trust-status')).toBeDefined();
    expect(screen.getByTestId('canvas-zoom-control')).toBeDefined();
    expect(screen.queryByTestId('draw-toolbar')).toBeFalsy();
    expect(screen.queryByTestId('status-canvas-controls')).toBeFalsy();
  });

  it('renders draw tools, frame select, grid select and zoom slider when trusted [SPEC-04]', () => {
    useCanvasViewStore.getState().setMode('design');
    render(<StatusBar trusted />);

    expect(screen.getByTestId('trust-status')).toBeDefined();
    expect(screen.getByTestId('draw-toolbar')).toBeDefined();
    expect(screen.getByTestId('canvas-frame-select')).toBeDefined();
    expect(screen.getByTestId('canvas-grid-select')).toBeDefined();
    expect(screen.getByTestId('canvas-zoom-control')).toBeDefined();
  });
});
