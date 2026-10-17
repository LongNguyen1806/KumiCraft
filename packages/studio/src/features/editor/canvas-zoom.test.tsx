// Zoom of the Canvas (R-RN-21).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { fitZoom, ZoomSelect } from './canvas-zoom.tsx';

describe('Canvas zoom [R-RN-21]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
  });

  it('fits the frame to the Canvas width, never above 100% or below 10%', () => {
    expect(fitZoom(1112, 1440)).toBeCloseTo(0.75);
    expect(fitZoom(1600, 375)).toBe(1);
    expect(fitZoom(100, 1440)).toBe(0.1);
    expect(fitZoom(0, 1440)).toBe(1);
  });

  it('offers "Fit" next to the fixed steps', () => {
    const onChange = vi.fn();
    render(<ZoomSelect zoom="fit" onChange={onChange} />);
    const select = screen.getByTestId('canvas-zoom-select');
    expect(select).toHaveProperty('value', 'fit');

    fireEvent.change(select, { target: { value: '0.75' } });
    fireEvent.change(select, { target: { value: 'fit' } });

    expect(onChange.mock.calls).toEqual([[0.75], ['fit']]);
  });
});
