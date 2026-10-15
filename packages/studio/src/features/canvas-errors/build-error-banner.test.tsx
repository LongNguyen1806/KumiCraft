// Unit tests for BuildErrorBanner (SPEC-04 M-RN, R-RN-25).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { BuildErrorBanner } from './build-error-banner.tsx';
import { useCanvasErrorStore } from './canvas-error-store.ts';

beforeAll(async () => {
  await initI18n();
});

describe('BuildErrorBanner [R-RN-25]', () => {
  beforeEach(() => {
    useCanvasErrorStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
  });

  it('calls onOpenLoc when canvas-build-error-open is clicked [R-RN-25]', () => {
    useCanvasErrorStore.getState().setBuildError({
      message: 'Unexpected token',
      file: 'src/pages/Home.tsx',
      line: 12,
      column: 5,
    });
    const onOpenLoc = vi.fn();
    render(<BuildErrorBanner onOpenLoc={onOpenLoc} />);

    const openBtn = screen.getByTestId('canvas-build-error-open');
    expect(openBtn.textContent).toBe('src/pages/Home.tsx:12:5');

    fireEvent.click(openBtn);
    expect(onOpenLoc).toHaveBeenCalledWith('src/pages/Home.tsx:12:5');
  });

  it('renders message but hides open button when line is missing [R-RN-25]', () => {
    useCanvasErrorStore.getState().setBuildError({
      message: 'Syntax error without line',
      file: 'src/pages/Home.tsx',
    });
    const onOpenLoc = vi.fn();
    render(<BuildErrorBanner onOpenLoc={onOpenLoc} />);

    expect(screen.getByTestId('canvas-build-error-message').textContent).toBe(
      'Syntax error without line',
    );
    expect(screen.queryByTestId('canvas-build-error-open')).toBeNull();
  });

  it('safely renders untrusted text without executing HTML tags [R-RN-25]', () => {
    const maliciousMsg = '<img src=x onerror=alert(1)>';
    useCanvasErrorStore.getState().setBuildError({
      message: maliciousMsg,
    });
    const { container } = render(<BuildErrorBanner onOpenLoc={vi.fn()} />);

    const pre = screen.getByTestId('canvas-build-error-message');
    expect(pre.textContent).toBe(maliciousMsg);
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders nothing when buildError is undefined [R-RN-25]', () => {
    const { container } = render(<BuildErrorBanner onOpenLoc={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
