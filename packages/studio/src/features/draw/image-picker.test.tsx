// @vitest-environment happy-dom
import type { InsertTarget } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as assetsClient from '../../api/assets-client.ts';
import * as sourceClient from '../../api/source-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { ImagePickerDialog } from './image-picker-dialog.tsx';
import { insertImageAt } from './insert-image.ts';

vi.mock('../editor/use-runner-status.ts', () => ({
  useRunnerStatus: () => ({
    status: { state: 'ready', origin: 'http://localhost:5173' },
    restart: vi.fn(),
  }),
}));

describe('Image Picker and Insertion (Scenarios #13, #14, #15) [R-DT-13, R-DT-14]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    useSelectionStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('[R-DT-13] Scenario 13: ImagePickerDialog loads assets, selecting item suggests alt, and insert invokes onPick', async () => {
    vi.spyOn(assetsClient, 'fetchAssets').mockResolvedValue({
      files: ['public/images/a.png', 'public/images/b.svg'],
    });

    const onPick = vi.fn();
    const onClose = vi.fn();

    render(<ImagePickerDialog open={true} onClose={onClose} onPick={onPick} />);

    const items = await screen.findAllByTestId('image-picker-item');
    expect(items.length).toBe(2);

    const itemB = items.find((el) => el.getAttribute('data-src') === '/images/b.svg');
    if (!itemB) throw new Error('Missing item for b.svg');

    fireEvent.click(itemB);

    const altInput = screen.getByTestId('image-picker-alt');
    if (!(altInput instanceof HTMLInputElement)) throw new Error('Expected HTMLInputElement');
    expect(altInput.value).toBe('B');

    const insertButton = screen.getByTestId('image-picker-insert');
    if (!(insertButton instanceof HTMLButtonElement)) throw new Error('Expected HTMLButtonElement');
    expect(insertButton.disabled).toBe(false);
    fireEvent.click(insertButton);

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith({
      image: { kind: 'existing', src: '/images/b.svg' },
      alt: 'B',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('[R-DT-13] Scenario 14: File > 5 MB shows error without onPick; valid file suggests alt; empty alt disables insert', async () => {
    vi.spyOn(assetsClient, 'fetchAssets').mockResolvedValue({ files: [] });

    const onPick = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <ImagePickerDialog open={true} onClose={onClose} onPick={onPick} />,
    );

    const fileInput = container.querySelector('input[type="file"]');
    if (!fileInput) throw new Error('Missing file input');

    // 1. File 6 MB -> triggers image-picker-error
    const bigFile = new File(['x'.repeat(10)], 'huge.png', { type: 'image/png' });
    Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    const errorAlert = screen.getByTestId('image-picker-error');
    expect(errorAlert).toBeDefined();
    expect(onPick).not.toHaveBeenCalled();

    // 2. Small file anh-san-pham.png -> suggests "Anh san pham"
    const smallFile = new File(['png-data'], 'anh-san-pham.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    await waitFor(() => {
      const altInput = screen.getByTestId('image-picker-alt');
      if (!(altInput instanceof HTMLInputElement)) throw new Error('Expected HTMLInputElement');
      expect(altInput.value).toBe('Anh san pham');
    });

    expect(screen.queryByTestId('image-picker-error')).toBeNull();

    // 3. Clearing alt disables insert button
    const altInput = screen.getByTestId('image-picker-alt');
    fireEvent.change(altInput, { target: { value: '' } });

    const insertButton = screen.getByTestId('image-picker-insert');
    if (!(insertButton instanceof HTMLButtonElement)) throw new Error('Expected HTMLButtonElement');
    expect(insertButton.disabled).toBe(true);
  });

  it('[R-DT-14] Scenario 15: insertImageAt calls applyStructureEdit and selects newly inserted element', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/pages/Home.tsx'],
      locs: ['src/pages/Home.tsx:42:5'],
    });

    const target: InsertTarget = {
      kind: 'child',
      parent: { loc: 'src/pages/Home.tsx:10:1', tag: 'section' },
      where: 'end',
    };

    const choice = {
      image: { kind: 'upload' as const, name: 'logo.png', dataBase64: 'iVBORw0KGgo=' },
      alt: 'Logo',
    };

    const result = await insertImageAt(target, choice);

    expect(result.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({
      kind: 'insertImage',
      target,
      image: choice.image,
      alt: 'Logo',
      className: 'w-full h-auto',
      placement: undefined,
      tailwindMajor: undefined,
    });

    const selected = useSelectionStore.getState().selectedRefs;
    expect(selected).toEqual([{ loc: 'src/pages/Home.tsx:42:5', index: 0 }]);
  });
});
