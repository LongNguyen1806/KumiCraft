// Block Library Panel (SPEC-04 section 15 M-LB, R-LB-10..15).
import {
  type ImageSource,
  LIBRARY_BLOCKS,
  type LibraryBlock,
  type LibraryBlockCategory,
  searchBlocks,
} from '@reactcraft/shared';
import { createElement, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { resources } from '../../i18n/i18n.ts';
import { type ErrorInfo, errorText } from '../../routes/error-text.ts';
import { useDndStore } from '../dnd/dnd-store.ts';
import { ImagePickerDialog } from '../draw/image-picker-dialog.tsx';
import { insertImageFromSelection } from '../draw/insert-image.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { insertBlock } from './insert-block.ts';
import { getBlockIcon } from './library-icons.ts';

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
  readonly disabled: boolean;
  readonly onSelect: (block: LibraryBlock) => void;
};

function BlockItem({ block, disabled, onSelect }: BlockItemProps) {
  const { t } = useTranslation('library');
  const rawKey = block.labelKey.replace(/^library:blocks\./, '');
  const label = isBlockKey(rawKey) ? t(`blocks.${rawKey}`) : block.id;

  return (
    <button
      type="button"
      data-testid={`library-block-${block.id}`}
      aria-disabled={disabled}
      draggable
      onClick={() => {
        if (!disabled) onSelect(block);
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', block.id);
        e.dataTransfer.effectAllowed = 'copy';
        useDndStore.getState().startDrag({ source: 'library', block });
      }}
      onDragEnd={() => {
        if (useDndStore.getState().drag !== undefined) {
          studioBridgeChannel.dragEnd(false);
          useDndStore.getState().endDrag();
        }
      }}
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border/50 bg-field/50 p-3 text-center transition-all hover:border-accent hover:bg-accent/5 aria-disabled:opacity-40"
    >
      <BlockIcon name={block.icon} className="h-5 w-5 text-ink-soft" />
      <span className="text-xs font-medium text-ink leading-tight">{label}</span>
    </button>
  );
}

type CategorySectionProps = {
  readonly category: LibraryBlockCategory;
  readonly blocks: readonly LibraryBlock[];
  readonly disabled: boolean;
  readonly onSelect: (block: LibraryBlock) => void;
};

function CategorySection({ category, blocks, disabled, onSelect }: CategorySectionProps) {
  const { t } = useTranslation('library');
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
        {t(`categories.${category}`)}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {blocks.map((block) => (
          <BlockItem key={block.id} block={block} disabled={disabled} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

type LibraryStatusHintProps = {
  readonly hasSelection: boolean;
  readonly errorInfo?: ErrorInfo | undefined;
};

function LibraryStatusHint({ hasSelection, errorInfo }: LibraryStatusHintProps) {
  const { t } = useTranslation('library');
  const { t: tError } = useTranslation('errors');
  const { t: tCommon } = useTranslation('common');

  if (!hasSelection) {
    return (
      <p
        data-testid="library-hint"
        className="rounded bg-amber-500/10 border border-amber-500/20 p-2 text-[11px] text-amber-900 dark:text-amber-200"
      >
        {t('hint')}
      </p>
    );
  }

  if (errorInfo !== undefined && errorInfo.code === 'design.selectInFile') {
    return (
      <p
        data-testid="library-hint"
        className="rounded bg-amber-500/10 border border-amber-500/20 p-2 text-[11px] text-amber-900 dark:text-amber-200"
      >
        {tCommon('design.selectInFile', errorInfo.params ?? {})}
      </p>
    );
  }

  if (errorInfo !== undefined && errorInfo.code !== 'design.selectInFile') {
    return (
      <p role="alert" className="text-xs text-danger" data-testid="library-error">
        {errorText(tError, errorInfo.code, errorInfo.params)}
      </p>
    );
  }

  return undefined;
}

type LibrarySearchHeaderProps = {
  readonly query: string;
  readonly onQueryChange: (q: string) => void;
  readonly hasSelection: boolean;
  readonly onOpenImagePicker: () => void;
  readonly errorInfo?: ErrorInfo | undefined;
};

function LibrarySearchHeader({
  query,
  onQueryChange,
  hasSelection,
  onOpenImagePicker,
  errorInfo,
}: LibrarySearchHeaderProps) {
  const { t } = useTranslation('library');

  return (
    <div className="p-3 border-b border-border/40 space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="search"
          data-testid="library-search"
          placeholder={t('search')}
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
          }}
          className="flex-1 rounded-md border border-border bg-field px-3 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          data-testid="library-insert-image"
          disabled={!hasSelection}
          onClick={onOpenImagePicker}
          className="rounded-md border border-border bg-field px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-field-hover disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
        >
          {t('insertImage', 'Ảnh…')}
        </button>
      </div>

      <LibraryStatusHint hasSelection={hasSelection} errorInfo={errorInfo} />
    </div>
  );
}

function useLibraryInsert(hasSelection: boolean) {
  const { i18n } = useTranslation('library');
  const [inserting, setInserting] = useState(false);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo>();

  const handleInsert = async (block: LibraryBlock) => {
    if (!hasSelection || inserting) return;
    setInserting(true);
    setErrorInfo(undefined);
    const res = await insertBlock(block, i18n.language);
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
  readonly onSelect: (block: LibraryBlock) => void;
};

function LibraryCategories({ categories, blocks, disabled, onSelect }: LibraryCategoriesProps) {
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-5">
      {categories.map((cat) => (
        <CategorySection
          key={cat}
          category={cat}
          blocks={blocks.filter((b) => b.category === cat)}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export function LibraryPanel() {
  const { t } = useTranslation('library');
  const selectedRefs = useSelectionStore((s) => s.selectedRefs);
  const [query, setQuery] = useState('');
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  const hasSelection = selectedRefs.length === 1;
  const filteredBlocks = useFilteredLibraryBlocks(query);
  const { inserting, errorInfo, handleInsert, handlePickImage } = useLibraryInsert(hasSelection);

  const activeCategories = CATEGORIES.filter((cat) =>
    filteredBlocks.some((b) => b.category === cat),
  );

  return (
    <aside
      aria-label={t('title')}
      data-testid="library-panel"
      className="flex h-full flex-col overflow-hidden bg-card-solid/60 text-xs"
    >
      <LibrarySearchHeader
        query={query}
        onQueryChange={setQuery}
        hasSelection={hasSelection}
        onOpenImagePicker={() => {
          setImagePickerOpen(true);
        }}
        errorInfo={errorInfo}
      />

      <LibraryCategories
        categories={activeCategories}
        blocks={filteredBlocks}
        disabled={!hasSelection || inserting}
        onSelect={(block) => {
          void handleInsert(block);
        }}
      />

      <ImagePickerDialog
        open={imagePickerOpen}
        onClose={() => {
          setImagePickerOpen(false);
        }}
        onPick={(choice) => {
          void handlePickImage(choice);
        }}
      />
    </aside>
  );
}
