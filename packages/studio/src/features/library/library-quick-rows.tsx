import type { LibraryBlock } from '@kumicraft/shared';
import { Plus, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { resources } from '../../i18n/i18n.ts';

type BlockKey = keyof (typeof resources.en.library)['blocks'];

function isBlockKey(key: string): key is BlockKey {
  return Object.hasOwn(resources.en.library.blocks, key);
}

function resolveLabel(block: LibraryBlock, t: (k: `blocks.${BlockKey}`) => string): string {
  const rawKey = block.labelKey.replace(/^library:blocks\./, '');
  return isBlockKey(rawKey) ? t(`blocks.${rawKey}`) : block.id;
}

type QuickRowProps = {
  readonly testId: string;
  readonly itemPrefix: string;
  readonly title: string;
  readonly blocks: readonly LibraryBlock[];
  readonly disabled: boolean;
  readonly onInsert: (block: LibraryBlock) => void;
  readonly isFavoriteRow?: boolean;
  readonly onToggleFavorite?: (blockId: string) => void;
};

function QuickBlockChip({
  block,
  itemPrefix,
  disabled,
  isFavoriteRow,
  onInsert,
  onToggleFavorite,
}: {
  readonly block: LibraryBlock;
  readonly itemPrefix: string;
  readonly disabled: boolean;
  readonly isFavoriteRow?: boolean | undefined;
  readonly onInsert: (block: LibraryBlock) => void;
  readonly onToggleFavorite?: ((blockId: string) => void) | undefined;
}) {
  const { t } = useTranslation('library');
  const label = resolveLabel(block, (k) => t(k));

  return (
    <div
      data-testid={`${itemPrefix}-${block.id}`}
      className="border-line bg-card-solid text-ink flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]"
    >
      <span className="truncate">{label}</span>
      {isFavoriteRow === true && onToggleFavorite !== undefined ? (
        <button
          type="button"
          aria-label={t('favoriteRemove', { name: label })}
          onClick={() => {
            onToggleFavorite(block.id);
          }}
          className="text-sun cursor-pointer hover:opacity-80"
        >
          <Star className="size-2.5 fill-current" aria-hidden="true" />
        </button>
      ) : undefined}
      <button
        type="button"
        disabled={disabled}
        aria-label={t('add', { name: label })}
        onClick={() => {
          onInsert(block);
        }}
        className="text-ink-faint hover:bg-accent-soft hover:text-accent cursor-pointer rounded p-0.5 disabled:cursor-not-allowed disabled:opacity-35"
      >
        <Plus className="size-2.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function QuickBlockRow({
  testId,
  itemPrefix,
  title,
  blocks,
  disabled,
  onInsert,
  isFavoriteRow,
  onToggleFavorite,
}: QuickRowProps) {
  if (blocks.length === 0) return undefined;

  return (
    <section data-testid={testId} className="space-y-1">
      <h3 className="text-ink-faint text-[11px] font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-1">
        {blocks.map((block) => (
          <QuickBlockChip
            key={block.id}
            block={block}
            itemPrefix={itemPrefix}
            disabled={disabled}
            isFavoriteRow={isFavoriteRow}
            onInsert={onInsert}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}

type LibraryQuickRowsProps = {
  readonly favoriteBlocks: readonly LibraryBlock[];
  readonly disabled: boolean;
  readonly onInsert: (block: LibraryBlock) => void;
  readonly onToggleFavorite: (blockId: string) => void;
};

export function LibraryQuickRows({
  favoriteBlocks,
  disabled,
  onInsert,
  onToggleFavorite,
}: LibraryQuickRowsProps) {
  const { t } = useTranslation('library');
  if (favoriteBlocks.length === 0) return undefined;

  return (
    <div className="space-y-2.5 pb-1">
      <QuickBlockRow
        testId="library-favorites"
        itemPrefix="library-fav-item"
        title={t('favorites')}
        blocks={favoriteBlocks}
        disabled={disabled}
        onInsert={onInsert}
        isFavoriteRow
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  );
}
