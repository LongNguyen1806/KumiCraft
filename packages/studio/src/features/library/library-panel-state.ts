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
import {
  dataGeneratorMode,
  type DataPickerMode,
  isDataGeneratorBlock,
} from './data-source-picker-dialog.tsx';
import { insertBlock } from './insert-block.ts';
import { getFavoriteBlocks, getRecentBlocks, toggleFavoriteBlock } from './library-favorites.ts';
import { getSelectedStyle, setSelectedStyle } from './library-styles.ts';

const CATEGORIES: readonly LibraryBlockCategory[] = [
  'layout',
  'content',
  'display',
  'form',
  'navigation',
  'interactive',
  'data',
  'composite',
  'landing',
  'screen',
];

function blocksByIds(ids: readonly string[]): readonly LibraryBlock[] {
  const result: LibraryBlock[] = [];
  for (const id of ids) {
    const block = LIBRARY_BLOCKS.find((b) => b.id === id);
    if (block !== undefined) result.push(block);
  }
  return result;
}

type BlockKey = keyof (typeof resources.en.library)['blocks'];

function isBlockKey(key: string): key is BlockKey {
  return Object.hasOwn(resources.en.library.blocks, key);
}

export function useLibraryInsert(canInsert: boolean, onSuccess?: () => void) {
  const { i18n } = useTranslation('library');
  const [inserting, setInserting] = useState(false);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo>();

  const runInsert = async (
    action: () => Promise<{ readonly ok: boolean; readonly error?: ErrorInfo | undefined }>,
  ) => {
    if (!canInsert || inserting) return;
    setInserting(true);
    setErrorInfo(undefined);
    const res = await action();
    setInserting(false);
    if (res.ok) onSuccess?.();
    else if (res.error) setErrorInfo(res.error);
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

function useLibraryQuickState(projectId: string | undefined, editable: boolean, query: string) {
  const [favChoice, setFavChoice] = useState<{
    readonly projectId: string | undefined;
    readonly ids: readonly string[];
  }>(() => ({ projectId, ids: getFavoriteBlocks(projectId) }));
  const [recentChoice, setRecentChoice] = useState<{
    readonly projectId: string | undefined;
    readonly ids: readonly string[];
  }>(() => ({ projectId, ids: getRecentBlocks(projectId) }));

  const favoriteIds =
    favChoice.projectId === projectId ? favChoice.ids : getFavoriteBlocks(projectId);
  const recentIds =
    recentChoice.projectId === projectId ? recentChoice.ids : getRecentBlocks(projectId);

  const toggleFavorite = (blockId: string) => {
    const next = toggleFavoriteBlock(projectId, blockId);
    setFavChoice({ projectId, ids: next });
  };

  const refreshRecent = () => {
    setRecentChoice({ projectId, ids: getRecentBlocks(projectId) });
  };

  const showQuick = editable && query.trim().length === 0;
  return {
    favoriteIds,
    toggleFavorite,
    favoriteBlocks: showQuick ? blocksByIds(favoriteIds) : [],
    recentBlocks: showQuick ? blocksByIds(recentIds) : [],
    bumpRecent: refreshRecent,
  };
}

function useProjectStyleChoice(projectId: string | undefined) {
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
  return { style, handleStyleChange };
}

function usePanelModalsState() {
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [dataPickerMode, setDataPickerMode] = useState<DataPickerMode | undefined>();
  const [hoveredPreview, setHoveredPreview] = useState<
    { readonly block: LibraryBlock; readonly label?: string | undefined } | undefined
  >();
  return {
    imagePickerOpen,
    setImagePickerOpen,
    iconPickerOpen,
    setIconPickerOpen,
    dataPickerMode,
    setDataPickerMode,
    hoveredPreview,
    setPreviewBlock: (block: LibraryBlock | undefined, label?: string) => {
      setHoveredPreview(block !== undefined ? { block, label } : undefined);
    },
  };
}

export function useLibraryPanelState() {
  const project = useProjectStore((s) => s.project);
  const projectId = project?.id;
  const [query, setQuery] = useState('');
  const modals = usePanelModalsState();
  const { style, handleStyleChange } = useProjectStyleChoice(projectId);
  const editable = useStyleLayerSupported();
  const editMode = useEditMode();
  const selectedRefs = useSelectionStore((s) => s.selectedRefs);
  const hasTreeRoot = useSelectionStore((s) => s.treeNodes.length > 0);
  const hasSelection = selectedRefs.length === 1;
  const visibleBlocks = useFilteredLibraryBlocks(query);
  const activeBlocks = editable ? visibleBlocks : [];
  const quick = useLibraryQuickState(projectId, editable, query);
  const rawInsert = useLibraryInsert(hasSelection || hasTreeRoot, quick.bumpRecent);

  return {
    query,
    setQuery,
    style,
    handleStyleChange,
    uiKit: project?.support.uiKit,
    ...modals,
    editable,
    isViewOnly: editMode === 'viewOnly',
    hasSelection,
    hasTreeRoot,
    visibleBlocks: activeBlocks,
    insert: {
      ...rawInsert,
      handleInsert: async (block: LibraryBlock, variantId?: string) => {
        if (isDataGeneratorBlock(block.id)) {
          if (hasSelection) modals.setDataPickerMode(dataGeneratorMode(block.id));
          return;
        }
        await rawInsert.handleInsert(block, variantId);
      },
    },
    activeCategories: CATEGORIES.filter((cat) => activeBlocks.some((b) => b.category === cat)),
    ...quick,
  };
}
