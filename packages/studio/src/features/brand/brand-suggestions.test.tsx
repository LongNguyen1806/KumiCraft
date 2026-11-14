// @vitest-environment happy-dom
// Unit tests for Brand palette suggestions and curated font pairs (TK-70, TK-71).
import type { ThemeInfo } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as eventsClientModule from '../../api/events-client.ts';
import * as projectClient from '../../api/project-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useHistoryStore } from '../history/history-store.ts';
import { useThemeStore } from '../inspector/use-project-theme.ts';
import { BrandPanel } from './brand-panel.tsx';

const BASE_THEME: ThemeInfo = {
  file: 'src/index.css',
  colors: [{ name: 'primary', value: '#2563eb' }],
  fonts: [],
  fontSizes: [],
  radii: [],
  shadows: [],
  breakpoints: [],
};

describe('Brand suggestions [TK-70, TK-71]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    vi.spyOn(eventsClientModule, 'createEventsClient').mockReturnValue({
      close: vi.fn(),
      isConnected: () => true,
    });
    vi.spyOn(projectClient, 'fetchProjectTheme').mockResolvedValue(BASE_THEME);
    vi.spyOn(useHistoryStore.getState(), 'load').mockResolvedValue(undefined);
    useThemeStore.setState({ theme: BASE_THEME });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('suggests 7 swatches from a seed color and applies them via ThemeEdit', async () => {
    const editSpy = vi.spyOn(projectClient, 'editTheme').mockResolvedValue(BASE_THEME);
    render(<BrandPanel />);

    fireEvent.click(screen.getByTestId('brand-palette-open'));
    const seed = screen.getByTestId('brand-palette-seed');
    fireEvent.change(seed, { target: { value: '#0f172a' } });

    expect(screen.getByTestId('brand-palette-swatch-primary')).toBeDefined();
    expect(screen.getByTestId('brand-palette-swatch-primary-foreground').textContent).toContain(
      '#ffffff',
    );
    expect(screen.getByTestId('brand-palette-swatch-border')).toBeDefined();

    fireEvent.click(screen.getByTestId('brand-palette-apply'));
    await waitFor(() => {
      expect(editSpy).toHaveBeenCalledTimes(7);
    });
    expect(editSpy).toHaveBeenCalledWith({
      op: 'set',
      kind: 'color',
      name: 'primary',
      value: '#0f172a',
    });
    expect(editSpy).toHaveBeenCalledWith({
      op: 'add',
      kind: 'color',
      name: 'primary-foreground',
      value: '#ffffff',
    });
  });

  it('lists 8 curated font pairs and imports + applies heading and body font tokens', async () => {
    const editSpy = vi.spyOn(projectClient, 'editTheme').mockResolvedValue(BASE_THEME);
    render(<BrandPanel />);

    fireEvent.click(screen.getByTestId('brand-fonts-open'));
    expect(screen.getByTestId('brand-fonts-panel').children).toHaveLength(8);

    fireEvent.click(screen.getByTestId('brand-font-apply-playfair-sourcesans'));
    await waitFor(() => {
      expect(editSpy).toHaveBeenCalledTimes(3);
    });
    expect(editSpy).toHaveBeenNthCalledWith(1, {
      op: 'importFont',
      families: ['Playfair Display', 'Source Sans 3'],
    });
    expect(editSpy).toHaveBeenNthCalledWith(2, {
      op: 'add',
      kind: 'font',
      name: 'heading',
      value: "'Playfair Display', serif",
    });
    expect(editSpy).toHaveBeenNthCalledWith(3, {
      op: 'add',
      kind: 'font',
      name: 'body',
      value: "'Source Sans 3', sans-serif",
    });
  });
});
