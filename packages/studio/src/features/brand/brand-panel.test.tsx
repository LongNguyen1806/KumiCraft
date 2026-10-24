// @vitest-environment happy-dom
import type { ThemeInfo } from '@kumicraft/shared';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as eventsClientModule from '../../api/events-client.ts';
import * as projectClient from '../../api/project-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useHistoryStore } from '../history/history-store.ts';
import { useThemeStore } from '../inspector/use-project-theme.ts';
import { BrandPanel } from './brand-panel.tsx';

const MOCK_THEME: ThemeInfo = {
  file: 'src/index.css',
  colors: [{ name: 'brand', value: '#2563eb' }],
  fonts: [{ name: 'display', value: '"Inter", sans-serif' }],
  fontSizes: [{ name: 'hero', value: '3rem' }],
  radii: [{ name: 'card', value: '0.75rem' }],
  shadows: [{ name: 'card', value: '0 4px 12px rgb(0 0 0 / 0.08)' }],
  breakpoints: [],
};

describe('BrandPanel (Scenarios #13, #14, #15) [R-TH-10, R-TH-11, R-TH-12, R-TH-13]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    vi.spyOn(eventsClientModule, 'createEventsClient').mockReturnValue({
      close: vi.fn(),
      isConnected: () => true,
    });
    vi.spyOn(projectClient, 'fetchProjectTheme').mockResolvedValue(MOCK_THEME);
    vi.spyOn(useHistoryStore.getState(), 'load').mockResolvedValue(undefined);
    useThemeStore.setState({ theme: MOCK_THEME });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('#13: renders 5 token groups and commits modified token value on Enter [R-TH-10, R-TH-11]', async () => {
    const updatedTheme: ThemeInfo = {
      ...MOCK_THEME,
      colors: [{ name: 'brand', value: '#1d4ed8' }],
    };
    const editSpy = vi.spyOn(projectClient, 'editTheme').mockResolvedValue(updatedTheme);

    render(<BrandPanel />);

    expect(screen.getByTestId('brand-group-color')).toBeDefined();
    expect(screen.getByTestId('brand-group-font')).toBeDefined();
    expect(screen.getByTestId('brand-group-fontSize')).toBeDefined();
    expect(screen.getByTestId('brand-group-radius')).toBeDefined();
    expect(screen.getByTestId('brand-group-shadow')).toBeDefined();

    const inputs = screen.getAllByTestId('brand-value');
    const brandInput = inputs[0];
    if (!brandInput) throw new Error('Missing brand-value input');
    fireEvent.change(brandInput, { target: { value: '#1d4ed8' } });
    fireEvent.keyDown(brandInput, { key: 'Enter' });

    await waitFor(() => {
      expect(editSpy).toHaveBeenCalledWith({
        op: 'set',
        kind: 'color',
        name: 'brand',
        value: '#1d4ed8',
      });
    });
    expect(useThemeStore.getState().theme.colors[0]?.value).toBe('#1d4ed8');
  });

  it('#14: validates token name before adding and calls editTheme on valid input [R-TH-12]', async () => {
    const updatedTheme: ThemeInfo = {
      ...MOCK_THEME,
      colors: [
        { name: 'brand', value: '#2563eb' },
        { name: 'accent', value: '#f59e0b' },
      ],
    };
    const editSpy = vi.spyOn(projectClient, 'editTheme').mockResolvedValue(updatedTheme);

    render(<BrandPanel />);

    fireEvent.click(screen.getByTestId('brand-add-color'));
    const nameInput = screen.getByTestId('brand-new-name');
    const valInput = screen.getByTestId('brand-new-value');
    const saveBtn = screen.getByTestId('brand-new-save');

    fireEvent.change(nameInput, { target: { value: 'Bad_Name' } });
    fireEvent.change(valInput, { target: { value: '#f59e0b' } });
    fireEvent.click(saveBtn);

    expect(screen.getByTestId('brand-error')).toBeDefined();
    expect(editSpy).not.toHaveBeenCalled();

    fireEvent.change(nameInput, { target: { value: 'accent' } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(editSpy).toHaveBeenCalledWith({
        op: 'add',
        kind: 'color',
        name: 'accent',
        value: '#f59e0b',
      });
    });
  });

  it('#15: removes immediately when usage is 0, and requires confirmation when usage > 0 [R-TH-13]', async () => {
    const editSpy = vi.spyOn(projectClient, 'editTheme').mockResolvedValue({
      ...MOCK_THEME,
      colors: [],
    });
    const usageSpy = vi
      .spyOn(projectClient, 'fetchThemeUsage')
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 4 });

    render(<BrandPanel />);

    const removeButtons = screen.getAllByTestId('brand-remove');
    const firstRemove = removeButtons[0];
    if (!firstRemove) throw new Error('Missing brand-remove button');
    fireEvent.click(firstRemove);

    await waitFor(() => {
      expect(usageSpy).toHaveBeenCalledWith('color', 'brand');
      expect(editSpy).toHaveBeenCalledWith({ op: 'remove', kind: 'color', name: 'brand' });
    });

    editSpy.mockClear();
    act(() => {
      useThemeStore.setState({ theme: MOCK_THEME });
    });

    const removeButtonsAgain = screen.getAllByTestId('brand-remove');
    const secondRemove = removeButtonsAgain[0];
    if (!secondRemove) throw new Error('Missing brand-remove button');
    fireEvent.click(secondRemove);

    await waitFor(() => {
      expect(screen.getByTestId('brand-confirm-delete')).toBeDefined();
    });
    expect(editSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('brand-confirm-delete'));
    await waitFor(() => {
      expect(editSpy).toHaveBeenCalledWith({ op: 'remove', kind: 'color', name: 'brand' });
    });
  });

  it('system: "bootstrap5", token primary inherited → có nhãn mặc định, không có nút xóa, hiện variable [R-ST-11]', () => {
    const bootstrapTheme: ThemeInfo = {
      file: 'src/index.css',
      system: 'bootstrap5',
      colors: [
        {
          name: 'primary',
          value: '#0d6efd',
          variable: '--bs-primary',
          inherited: true,
        },
      ],
      fonts: [],
      fontSizes: [],
      radii: [],
      shadows: [],
      breakpoints: [],
    };
    useThemeStore.setState({ theme: bootstrapTheme });

    render(<BrandPanel />);

    expect(screen.getByTestId('brand-system-name').textContent).toContain('Bootstrap 5');
    expect(screen.getByTestId('brand-file-path').textContent).toContain('src/index.css');
    expect(screen.getByTestId('brand-token-variable').textContent).toBe('--bs-primary');
    expect(screen.getByTestId('brand-inherited')).toBeDefined();
    expect(screen.queryByTestId('brand-remove')).toBeNull();
  });
});
