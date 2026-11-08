// The tree reads every shown folder again after Undo/Redo (K10: macOS CI showed a restored file
// missing because the tree waited for a file-change event that KumiCraft's own writes never send).
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as filesClient from '../../api/files-client.ts';
import { useFilesStore } from './files-store.ts';

const SRC = { name: 'src', path: 'src', kind: 'directory' as const, hidden: false };
const GUIDE = { name: 'guide.md', path: 'src/guide.md', kind: 'file' as const, hidden: false };

describe('files store refreshLoaded [K10]', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useFilesStore.getState().reset();
  });

  it('lists again every folder already shown, with what is on disk now', async () => {
    const tree = vi
      .spyOn(filesClient, 'fetchFileTree')
      .mockImplementation((dir = '') =>
        Promise.resolve({ dir, truncated: false, entries: dir === '' ? [SRC] : [] }),
      );
    await useFilesStore.getState().loadDir('', true);
    await useFilesStore.getState().loadDir('src', true);
    tree.mockClear();
    tree.mockImplementation((dir = '') =>
      Promise.resolve({ dir, truncated: false, entries: dir === 'src' ? [GUIDE] : [SRC] }),
    );

    await useFilesStore.getState().refreshLoaded();

    expect(tree.mock.calls.map((c) => c[0] ?? '').sort()).toEqual(['', 'src']);
    expect(useFilesStore.getState().treeData['src']?.map((e) => e.path)).toEqual(['src/guide.md']);
  });
});
