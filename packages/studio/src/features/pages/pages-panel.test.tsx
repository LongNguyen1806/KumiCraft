import type { PageInfo } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import * as projectClient from '../../api/project-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { AddPageForm } from './add-page-form.tsx';
import { PagesPanel } from './pages-panel.tsx';

describe('PagesPanel & AddPageForm [WP-2.05]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('scenario 17: auto-suggests path and file, keeping manual path edits [R-PG-11]', () => {
    vi.spyOn(projectClient, 'fetchProjectDirs').mockResolvedValue(['src/pages', 'src/components']);
    render(<AddPageForm convention={true} />);

    const nameInput = screen.getByTestId('page-name');
    const pathInput = screen.getByTestId('page-path');
    const fileInput = screen.getByTestId('page-file');

    fireEvent.change(nameInput, { target: { value: 'Giới thiệu' } });
    expect(pathInput).toHaveProperty('value', '/gioi-thieu');
    expect(fileInput).toHaveProperty('value', 'GioiThieu.tsx');

    fireEvent.change(pathInput, { target: { value: '/gioi-thieu-chung' } });
    expect(pathInput).toHaveProperty('value', '/gioi-thieu-chung');

    fireEvent.change(nameInput, { target: { value: 'Giới thiệu công ty' } });
    expect(pathInput).toHaveProperty('value', '/gioi-thieu-chung');
    expect(fileInput).toHaveProperty('value', 'GioiThieuCongTy.tsx');
  });

  it('scenario 18: locks add/rename/delete when convention is false and displays note [R-PG-10]', () => {
    vi.spyOn(projectClient, 'fetchProjectDirs').mockResolvedValue(['src/pages']);
    const mockPages: readonly PageInfo[] = [
      { path: '/', component: 'Home', dynamic: false },
      { path: '/about', component: 'About', dynamic: false },
    ];

    render(<PagesPanel pages={mockPages} convention={false} />);

    expect(screen.getByTestId('pages-panel')).toBeDefined();
    expect(screen.getByTestId('pages-not-convention')).toBeDefined();

    const addButton = screen.getByTestId('page-add');
    expect(addButton).toHaveProperty('disabled', true);

    const renameHome = screen.getByTestId('page-rename-/');
    expect(renameHome).toHaveProperty('disabled', true);

    const deleteHome = screen.getByTestId('page-delete-/');
    expect(deleteHome).toHaveProperty('disabled', true);

    const renameAbout = screen.getByTestId('page-rename-/about');
    expect(renameAbout).toHaveProperty('disabled', true);

    const deleteAbout = screen.getByTestId('page-delete-/about');
    expect(deleteAbout).toHaveProperty('disabled', true);
  });
});
