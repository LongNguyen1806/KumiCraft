// Library Panel listing draggable / insertable UI blocks grouped by category (SPEC-04 M-LB).
import type { LibraryBlock, LibraryBlockCategory, UiKitReport } from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

import { ImagePickerDialog } from '../draw/image-picker-dialog.tsx';
import { IconPickerDialog } from '../icons/icon-picker.tsx';
import { DataSourcePickerDialog } from './data-source-picker-dialog.tsx';
import { BlockItem } from './library-block-item.tsx';
import { useLibraryPanelState } from './library-panel-state.ts';
import { LibraryPreviewCard } from './library-preview-card.tsx';
import { LibraryQuickRows } from './library-quick-rows.tsx';
import { LibrarySearchHeader } from './library-search-header.tsx';

type CategorySectionProps = {
  readonly category: LibraryBlockCategory;
  readonly blocks: readonly LibraryBlock[];
  readonly insertLocked: boolean;
  readonly hasSelection: boolean;
  readonly hasTreeRoot: boolean;
  readonly dragDisabled?: boolean | undefined;
  readonly uiKit?: UiKitReport | undefined;
  readonly favoriteIds: readonly string[];
  readonly onToggleFavorite: (blockId: string) => void;
  readonly onPreview: (block: LibraryBlock | undefined, label?: string) => void;
  readonly onSelect: (block: LibraryBlock, variantId?: string) => void;
};

function CategorySection({
  category,
  blocks,
  insertLocked,
  hasSelection,
  hasTreeRoot,
  dragDisabled,
  uiKit,
  favoriteIds,
  onToggleFavorite,
  onPreview,
  onSelect,
}: CategorySectionProps) {
  const { t } = useTranslation('library');
  return (
    <div className="space-y-1.5">
      <h3 className="text-ink-faint text-[11px] font-semibold">{t(`categories.${category}`)}</h3>
      <div className="grid grid-cols-3 gap-1.5">
        {blocks.map((block) => {
          const canInsert = hasSelection || (block.category === 'screen' && hasTreeRoot);
          return (
            <BlockItem
              key={block.id}
              block={block}
              disabled={insertLocked || !canInsert}
              dragDisabled={dragDisabled}
              uiKit={uiKit}
              isFavorite={favoriteIds.includes(block.id)}
              onToggleFavorite={onToggleFavorite}
              onPreview={onPreview}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </div>
  );
}

function LibraryUnsupportedNotice() {
  const { t } = useTranslation('library');
  return (
    <div className="text-ink-soft p-4 text-xs">
      <p>{t('unsupportedForSystem')}</p>
    </div>
  );
}

function LibraryContent({ s }: { readonly s: ReturnType<typeof useLibraryPanelState> }) {
  const { t } = useTranslation('library');
  if (!s.editable) return <LibraryUnsupportedNotice />;

  const insertLocked = s.insert.inserting || s.isViewOnly;
  const onSelect = (b: LibraryBlock, variantId?: string) => {
    void s.insert.handleInsert(b, variantId);
  };

  return (
    <div className="flex-1 space-y-3.5 overflow-y-auto py-2.5">
      <LibraryQuickRows
        favoriteBlocks={s.favoriteBlocks}
        recentBlocks={s.recentBlocks}
        disabled={insertLocked || !s.hasSelection}
        onInsert={(b) => {
          onSelect(b);
        }}
        onToggleFavorite={s.toggleFavorite}
      />
      {s.activeCategories.length === 0 ? (
        <p className="text-ink-faint px-1 py-4 text-center text-[11px]">{t('empty')}</p>
      ) : (
        s.activeCategories.map((cat) => (
          <CategorySection
            key={cat}
            category={cat}
            blocks={s.visibleBlocks.filter((b) => b.category === cat)}
            insertLocked={insertLocked}
            hasSelection={s.hasSelection}
            hasTreeRoot={s.hasTreeRoot}
            dragDisabled={s.isViewOnly}
            uiKit={s.uiKit}
            favoriteIds={s.favoriteIds}
            onToggleFavorite={s.toggleFavorite}
            onPreview={s.setPreviewBlock}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  );
}

function LibraryDialogs({ s }: { readonly s: ReturnType<typeof useLibraryPanelState> }) {
  return (
    <>
      <ImagePickerDialog
        open={s.imagePickerOpen}
        onClose={() => {
          s.setImagePickerOpen(false);
        }}
        onPick={(c) => {
          void s.insert.handlePickImage(c);
        }}
      />
      <IconPickerDialog
        open={s.iconPickerOpen}
        onClose={() => {
          s.setIconPickerOpen(false);
        }}
        onPick={(icon) => {
          void s.insert.handlePickIcon(icon);
        }}
      />
      <DataSourcePickerDialog
        open={s.dataPickerMode !== undefined}
        mode={s.dataPickerMode ?? 'form'}
        onClose={() => {
          s.setDataPickerMode(undefined);
        }}
        onInserted={s.bumpRecent}
      />
    </>
  );
}

export function LibraryPanel() {
  const { t } = useTranslation('library');
  const s = useLibraryPanelState();

  return (
    <aside
      aria-label={t('title')}
      data-testid="library-panel"
      className="relative flex h-full flex-col overflow-hidden text-xs"
    >
      <LibrarySearchHeader
        query={s.query}
        onQueryChange={s.setQuery}
        hasSelection={s.hasSelection && !s.isViewOnly}
        onOpenImagePicker={() => {
          s.setImagePickerOpen(true);
        }}
        onOpenIconPicker={() => {
          s.setIconPickerOpen(true);
        }}
        style={s.style}
        onStyleChange={s.handleStyleChange}
        errorInfo={s.insert.errorInfo}
      />
      <LibraryContent s={s} />
      <LibraryPreviewCard block={s.hoveredPreview?.block} label={s.hoveredPreview?.label} />
      <LibraryDialogs s={s} />
    </aside>
  );
}
