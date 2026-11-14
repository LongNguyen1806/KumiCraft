// State hooks for LibraryPanel (block search, style, image & icon insertion).
import {
  type ImageSource,
  LIBRARY_BLOCKS,
  type LibraryBlock,
  type LibraryBlockCategory,
  type LibraryStyle,
  searchBlocks,
} from '@kumicraft/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { resources } from '../../i18n/i18n.ts';
import { type ErrorInfo } from '../../routes/error-text.ts';
import { insertImageFromSelection } from '../draw/insert-image.ts';
import { type IconEntry } from '../icons/icon-svg.ts';
import { insertIconFromSelection } from '../icons/insert-icon.ts';
import { useProjectStore } from '../project/project-store.ts';
import { useEditMode } from '../project/use-edit-mode.ts';
import { useStyleLayerSupported } from '../project/use-style-edit.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { insertBlock } from './insert-block.ts';
import { getSelectedStyle, setSelectedStyle } from './library-styles.ts';

const CATEGORIES: readonly LibraryBlockCategory[] = [
  'layout',
  'content',
  'form',
  'data',
  'composite',
];

type BlockKey = keyof (typeof resources.en.library)['blocks'];

function isBlockKey(key: string): key is BlockKey {
  return Object.hasOwn(resources.en.library.blocks, key);
}

export function useLibraryInsert(hasSelection: boolean) {
  const { i18n } = useTranslation('library');
  const [inserting, setInserting] = useState(false);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo>();

  const runInsert = async (
    action: () => Promise<{ readonly ok: boolean; readonly error?: ErrorInfo | undefined }>,
  ) => {
    if (!hasSelection || inserting) return;
    setInserting(true);
    setErrorInfo(undefined);
    const res = await action();
    setInserting(false);
    if (!res.ok && res.error) setErrorInfo(res.error);
  };

  const handleInsert = (block: LibraryBlock, variantId?: string) =>
    runInsert(() => insertBlock(block, i18n.language, variantId));

  const handlePickImage = (choice: { readonly image: ImageSource; readonly alt: string }) =>
    runInsert(() => insertImageFromSelection(choice));

  const handlePickIcon = (icon: IconEntry) => runInsert(() => insertIconFromSelection(icon));

  return { inserting, errorInfo, handleInsert, handlePickImage, handlePickIcon };
}

function useFilteredLibraryBlocks(query: string): readonly LibraryBlock[] {
  return useMemo(() => {
    return searchBlocks(query, (id) => {
      const block = LIBRARY_BLOCKS.find((b) => b.id === id);
      if (!block) return { vi: id, en: id };
      const rawKey = block.labelKey.replace(/^library:blocks\./, '');
      if (isBlockKey(rawKey)) {
        return {
          vi: resources.vi.library.blocks[rawKey],
          en: resources.en.library.blocks[rawKey],
        };
      }
      return { vi: id, en: id };
    });
  }, [query]);
}

export function useLibraryPanelState() {
  const project = useProjectStore((s) => s.project);
  const projectId = project?.id;
  const [query, setQuery] = useState('');
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [styleChoice, setStyleChoice] = useState<{
    readonly projectId: string | undefined;
    readonly value: LibraryStyle;
  }>(() => ({ projectId, value: getSelectedStyle(projectId) }));
  const style =
    styleChoice.projectId === projectId ? styleChoice.value : getSelectedStyle(projectId);
  const handleStyleChange = (next: LibraryStyle) => {
    setSelectedStyle(projectId, next);
    setStyleChoice({ projectId, value: next });
  };
  const editable = useStyleLayerSupported();
  const editMode = useEditMode();
  const selectedRefs = useSelectionStore((s) => s.selectedRefs);
  const hasSelection = selectedRefs.length === 1;
  const filteredBlocks = useFilteredLibraryBlocks(query);
  const visibleBlocks = editable ? filteredBlocks : [];
  const insert = useLibraryInsert(hasSelection);
  const activeCategories = CATEGORIES.filter((cat) =>
    visibleBlocks.some((b) => b.category === cat),
  );

  return {
    query,
    setQuery,
    style,
    handleStyleChange,
    uiKit: project?.support.uiKit,
    imagePickerOpen,
    setImagePickerOpen,
    iconPickerOpen,
    setIconPickerOpen,
    editable,
    isViewOnly: editMode === 'viewOnly',
    hasSelection,
    visibleBlocks,
    insert,
    activeCategories,
  };
}
