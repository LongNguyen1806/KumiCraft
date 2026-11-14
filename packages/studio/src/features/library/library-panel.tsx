// Block Library Panel (SPEC-04 section 15 M-LB, R-LB-10..15).
import {
  type ImageSource,
  LIBRARY_BLOCKS,
  type LibraryBlock,
  type LibraryBlockCategory,
  type LibraryStyle,
  searchBlocks,
  supportsUiKitBlock,
  type UiKitReport,
} from '@kumicraft/shared';
import { createElement, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { InsertButton } from '../../components/ui/insert-button.tsx';
import { resources } from '../../i18n/i18n.ts';
import { type ErrorInfo } from '../../routes/error-text.ts';
import { useDndStore } from '../dnd/dnd-store.ts';
import { ImagePickerDialog } from '../draw/image-picker-dialog.tsx';
import { insertImageFromSelection } from '../draw/insert-image.ts';
import { useProjectStore } from '../project/project-store.ts';
import { useEditMode } from '../project/use-edit-mode.ts';
import { useStyleLayerSupported } from '../project/use-style-edit.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { insertBlock } from './insert-block.ts';
import { getBlockIcon } from './library-icons.ts';
import { LibrarySearchHeader } from './library-search-header.tsx';
import { getSelectedStyle, setSelectedStyle } from './library-styles.ts';
import { LibraryVariantMenu } from './library-variant-menu.tsx';
import { getSelectedVariant, setSelectedVariant } from './library-variants.ts';

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

function BlockIcon({ name, className }: { readonly name: string; readonly className?: string }) {
  return createElement(getBlockIcon(name), { className });
}

type BlockItemProps = {
  readonly block: LibraryBlock;
  /** The + button is locked: nothing selected, or an insert is running. */
  readonly disabled: boolean;
  /** Drag is disabled (e.g. view-only mode). */
  readonly dragDisabled?: boolean | undefined;
  readonly uiKit?: UiKitReport | undefined;
  readonly onSelect: (block: LibraryBlock, variantId?: string) => void;
};

function handleBlockDragStart(
  e: React.DragEvent<HTMLDivElement>,
  block: LibraryBlock,
  dragDisabled: boolean | undefined,
  variantId?: string,
) {
  if (dragDisabled) return;
  e.dataTransfer.setData('text/plain', block.id);
  e.dataTransfer.effectAllowed = 'copy';
  useDndStore.getState().startDrag({ source: 'library', block, variantId });
}

function handleBlockDragEnd() {
  if (useDndStore.getState().drag !== undefined) {
    studioBridgeChannel.dragEnd(false);
    useDndStore.getState().endDrag();
  }
}

/**
 * A block is dragged onto the Canvas; only its + button inserts at the selection (R-LB-14). A click
 * on the block itself does nothing, so picking a block never changes the page by accident.
 */
function BlockItem({ block, disabled, dragDisabled, uiKit, onSelect }: BlockItemProps) {
  const { t } = useTranslation('library');
  const rawKey = block.labelKey.replace(/^library:blocks\./, '');
  const label = isBlockKey(rawKey) ? t(`blocks.${rawKey}`) : block.id;
  const [selectedVariant, setSelectedVariantState] = useState<string | undefined>(() =>
    getSelectedVariant(block.id),
  );
  const usesKit = supportsUiKitBlock(block.id, uiKit);

  const handleSelectVariant = (nextVariant: string | undefined) => {
    setSelectedVariant(block.id, nextVariant);
    setSelectedVariantState(nextVariant);
  };

  return (
    <div
      data-testid={`library-block-${block.id}`}
      draggable={!dragDisabled}
      onDragStart={(e) => {
        handleBlockDragStart(e, block, dragDisabled, selectedVariant);
      }}
      onDragEnd={handleBlockDragEnd}
      className="relative flex min-w-0 cursor-grab flex-col items-center gap-1 rounded-[7px] border border-line bg-card-solid px-1 pt-2.5 pb-2 text-center transition-colors hover:border-border hover:bg-field active:cursor-grabbing"
    >
      <LibraryVariantMenu
        block={block}
        blockLabel={label}
        selectedVariant={selectedVariant}
        onSelectVariant={handleSelectVariant}
      />
      <BlockIcon name={block.icon} className="size-[18px] text-ink-soft" />
      <span className="max-w-full text-[11px] leading-tight break-words text-ink">{label}</span>
      {usesKit && (
        <span
          data-testid={`library-kit-badge-${block.id}`}
          className="rounded bg-accent/10 px-1 py-0.5 text-[9px] leading-none font-medium text-accent"
        >
          {t('fromProject')}
        </span>
      )}
      <InsertButton
        testId={`library-add-${block.id}`}
        label={t('add', { name: label })}
        disabled={disabled}
        onInsert={() => {
          onSelect(block, selectedVariant);
        }}
      />
    </div>
  );
}

type CategorySectionProps = {
  readonly category: LibraryBlockCategory;
  readonly blocks: readonly LibraryBlock[];
  readonly disabled: boolean;
  readonly dragDisabled?: boolean | undefined;
  readonly uiKit?: UiKitReport | undefined;
  readonly onSelect: (block: LibraryBlock, variantId?: string) => void;
};

function CategorySection({
  category,
  blocks,
  disabled,
  dragDisabled,
  uiKit,
  onSelect,
}: CategorySectionProps) {
  const { t } = useTranslation('library');
  return (
    <div className="space-y-1.5">
      <h3 className="text-[11px] font-semibold text-ink-faint">{t(`categories.${category}`)}</h3>
      <div className="grid grid-cols-3 gap-1.5">
        {blocks.map((block) => (
          <BlockItem
            key={block.id}
            block={block}
            disabled={disabled}
            dragDisabled={dragDisabled}
            uiKit={uiKit}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function useLibraryInsert(hasSelection: boolean) {
  const { i18n } = useTranslation('library');
  const [inserting, setInserting] = useState(false);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo>();

  const handleInsert = async (block: LibraryBlock, variantId?: string) => {
    if (!hasSelection || inserting) return;
    setInserting(true);
    setErrorInfo(undefined);
    const res = await insertBlock(block, i18n.language, variantId);
    setInserting(false);
    if (!res.ok && res.error) setErrorInfo(res.error);
  };

  const handlePickImage = async (choice: { readonly image: ImageSource; readonly alt: string }) => {
    if (!hasSelection || inserting) return;
    setInserting(true);
    setErrorInfo(undefined);
    const res = await insertImageFromSelection(choice);
    setInserting(false);
    if (!res.ok && res.error) setErrorInfo(res.error);
  };

  return { inserting, errorInfo, handleInsert, handlePickImage };
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

type LibraryCategoriesProps = {
  readonly categories: readonly LibraryBlockCategory[];
  readonly blocks: readonly LibraryBlock[];
  readonly disabled: boolean;
  readonly dragDisabled?: boolean | undefined;
  readonly uiKit?: UiKitReport | undefined;
  readonly onSelect: (block: LibraryBlock, variantId?: string) => void;
};

function LibraryCategories({
  categories,
  blocks,
  disabled,
  dragDisabled,
  uiKit,
  onSelect,
}: LibraryCategoriesProps) {
  return (
    <div className="flex-1 space-y-3.5 overflow-y-auto py-2.5">
      {categories.map((cat) => (
        <CategorySection
          key={cat}
          category={cat}
          blocks={blocks.filter((b) => b.category === cat)}
          disabled={disabled}
          dragDisabled={dragDisabled}
          uiKit={uiKit}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function LibraryUnsupportedNotice() {
  const { t } = useTranslation('library');
  return (
    <div className="p-4 text-xs text-ink-soft">
      <p>
        {t('unsupportedForSystem', {
          defaultValue:
            'Mẫu phần tử có sẵn dùng Tailwind chưa hỗ trợ cho hệ này. Dùng tab Thành phần để chèn component của dự án.',
        })}
      </p>
    </div>
  );
}

function LibraryContent({
  editable,
  activeCategories,
  visibleBlocks,
  hasSelection,
  inserting,
  disabled,
  dragDisabled,
  uiKit,
  onSelect,
}: {
  readonly editable: boolean;
  readonly activeCategories: readonly LibraryBlockCategory[];
  readonly visibleBlocks: readonly LibraryBlock[];
  readonly hasSelection: boolean;
  readonly inserting: boolean;
  readonly disabled?: boolean | undefined;
  readonly dragDisabled?: boolean | undefined;
  readonly uiKit?: UiKitReport | undefined;
  readonly onSelect: (block: LibraryBlock, variantId?: string) => void;
}) {
  if (!editable) return <LibraryUnsupportedNotice />;
  return (
    <LibraryCategories
      categories={activeCategories}
      blocks={visibleBlocks}
      disabled={disabled ?? (!hasSelection || inserting)}
      dragDisabled={dragDisabled}
      uiKit={uiKit}
      onSelect={onSelect}
    />
  );
}

function useLibraryPanelState() {
  const project = useProjectStore((s) => s.project);
  const projectId = project?.id;
  const [query, setQuery] = useState('');
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
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
    editable,
    isViewOnly: editMode === 'viewOnly',
    hasSelection,
    visibleBlocks,
    insert,
    activeCategories,
  };
}

export function LibraryPanel() {
  const { t } = useTranslation('library');
  const s = useLibraryPanelState();

  return (
    <aside
      aria-label={t('title')}
      data-testid="library-panel"
      className="flex h-full flex-col overflow-hidden text-xs"
    >
      <LibrarySearchHeader
        query={s.query}
        onQueryChange={s.setQuery}
        hasSelection={s.hasSelection && !s.isViewOnly}
        onOpenImagePicker={() => {
          s.setImagePickerOpen(true);
        }}
        style={s.style}
        onStyleChange={s.handleStyleChange}
        errorInfo={s.insert.errorInfo}
      />

      <LibraryContent
        editable={s.editable}
        activeCategories={s.activeCategories}
        visibleBlocks={s.visibleBlocks}
        hasSelection={s.hasSelection}
        inserting={s.insert.inserting}
        disabled={!s.hasSelection || s.insert.inserting || s.isViewOnly}
        dragDisabled={s.isViewOnly}
        uiKit={s.uiKit}
        onSelect={(b, variantId) => {
          void s.insert.handleInsert(b, variantId);
        }}
      />

      <ImagePickerDialog
        open={s.imagePickerOpen}
        onClose={() => {
          s.setImagePickerOpen(false);
        }}
        onPick={(c) => {
          void s.insert.handlePickImage(c);
        }}
      />
    </aside>
  );
}
