import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import * as filesClient from '../../api/files-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { FolderPicker } from './folder-picker.tsx';

describe('FolderPicker [WP-4.00]', () => {
  beforeAll(async () => {
    await initI18n();
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("[WP-4.00] test 13: folder-picker ở chế độ thư mục: chỉ hiện thư mục, mở thư mục con khi bấm, Chọn → onPick('src/pages/shop'); Esc → onClose", async () => {
    vi.spyOn(filesClient, 'fetchFileTree').mockImplementation((dir) => {
      if (!dir) {
        return Promise.resolve({
          dir: '',
          entries: [
            { name: 'src', path: 'src', kind: 'directory', hidden: false },
            { name: 'package.json', path: 'package.json', kind: 'file', hidden: false },
          ],
          truncated: false,
        });
      }
      if (dir === 'src') {
        return Promise.resolve({
          dir: 'src',
          entries: [
            { name: 'pages', path: 'src/pages', kind: 'directory', hidden: false },
            { name: 'main.tsx', path: 'src/main.tsx', kind: 'file', hidden: false },
          ],
          truncated: false,
        });
      }
      if (dir === 'src/pages') {
        return Promise.resolve({
          dir: 'src/pages',
          entries: [
            { name: 'shop', path: 'src/pages/shop', kind: 'directory', hidden: false },
            { name: 'Home.tsx', path: 'src/pages/Home.tsx', kind: 'file', hidden: false },
          ],
          truncated: false,
        });
      }
      if (dir === 'src/pages/shop') {
        return Promise.resolve({
          dir: 'src/pages/shop',
          entries: [
            { name: 'Cart.tsx', path: 'src/pages/shop/Cart.tsx', kind: 'file', hidden: false },
          ],
          truncated: false,
        });
      }
      return Promise.resolve({ dir, entries: [], truncated: false });
    });

    const onPick = vi.fn();
    const onClose = vi.fn();

    render(<FolderPicker open={true} mode="folder" onPick={onPick} onClose={onClose} />);

    // Initial load: src should be visible, package.json should NOT be visible (folder mode)
    await waitFor(() => {
      expect(screen.getByTestId('picker-item-src')).toBeDefined();
    });
    expect(screen.queryByTestId('picker-item-package.json')).toBeNull();

    // Click src -> expands and loads src/pages
    fireEvent.click(screen.getByTestId('picker-item-src'));
    await waitFor(() => {
      expect(screen.getByTestId('picker-item-src/pages')).toBeDefined();
    });
    expect(screen.queryByTestId('picker-item-src/main.tsx')).toBeNull();

    // Click src/pages -> expands and loads src/pages/shop
    fireEvent.click(screen.getByTestId('picker-item-src/pages'));
    await waitFor(() => {
      expect(screen.getByTestId('picker-item-src/pages/shop')).toBeDefined();
    });
    expect(screen.queryByTestId('picker-item-src/pages/Home.tsx')).toBeNull();

    // Click src/pages/shop to select it
    fireEvent.click(screen.getByTestId('picker-item-src/pages/shop'));

    // Confirm button is enabled and calls onPick
    const confirmBtn = screen.getByTestId('folder-picker-confirm');
    expect(confirmBtn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(confirmBtn);

    expect(onPick).toHaveBeenCalledWith('src/pages/shop');

    // Esc closes
    const tree = screen.getByTestId('folder-picker-tree');
    fireEvent.keyDown(tree, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it("[WP-4.00] test 14: folder-picker ở chế độ file với ['.scss'] → chỉ hiện thư mục và file .scss", async () => {
    vi.spyOn(filesClient, 'fetchFileTree').mockResolvedValue({
      dir: '',
      entries: [
        { name: 'src', path: 'src', kind: 'directory', hidden: false },
        { name: 'main.scss', path: 'main.scss', kind: 'file', hidden: false },
        { name: 'index.css', path: 'index.css', kind: 'file', hidden: false },
        { name: 'app.tsx', path: 'app.tsx', kind: 'file', hidden: false },
      ],
      truncated: false,
    });

    render(
      <FolderPicker
        open={true}
        mode="file"
        extensions={['.scss']}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('picker-item-src')).toBeDefined();
    });
    expect(screen.getByTestId('picker-item-main.scss')).toBeDefined();
    expect(screen.queryByTestId('picker-item-index.css')).toBeNull();
    expect(screen.queryByTestId('picker-item-app.tsx')).toBeNull();
  });
});
