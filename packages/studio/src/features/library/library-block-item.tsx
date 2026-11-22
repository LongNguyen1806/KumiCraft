// Interactive tile item in Library Panel (variant picker, favorite star, hover/focus SVG preview, + insert).
import type { LibraryBlock } from '@kumicraft/content';
import { supportsUiKitBlock } from '@kumicraft/content';
import type { UiKitReport } from '@kumicraft/shared';
import { Plus, Star } from 'lucide-react';
import { createElement, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { studioBridgeChannel } from '../../core/bridge-channel.ts';
import { useDndStore } from '../../core/dnd-store.ts';
import { resources } from '../../i18n/i18n.ts';
import { getBlockIcon } from './library-icons.ts';
import { previewAnchorOf, type PreviewHandler } from './library-preview-card.tsx';
import { LibraryVariantMenu } from './library-variant-menu.tsx';
import { getSelectedVariant, setSelectedVariant } from './library-variants.ts';

type BlockKey = keyof (typeof resources.en.library)['blocks'];

function isBlockKey(key: string): key is BlockKey {
  return Object.hasOwn(resources.en.library.blocks, key);
}

function BlockIcon({ name, className }: { readonly name: string; readonly className?: string }) {
  return createElement(getBlockIcon(name), { className });
}

function handleBlockDragStart(
  e: React.DragEvent<HTMLDivElement>,
  block: LibraryBlock,
  dragDisabled: boolean | undefined,
  variantId: string | undefined,
): void {
  if (dragDisabled) {
    e.preventDefault();
    return;
  }
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('text/plain', block.id);
  useDndStore.getState().startDrag({ source: 'library', block, variantId });
}

function handleBlockDragEnd(): void {
  if (useDndStore.getState().drag !== undefined) {
    studioBridgeChannel.dragEnd(false);
    useDndStore.getState().endDrag();
  }
}

function InsertButton({
  testId,
  label,
  disabled,
  onInsert,
}: {
  readonly testId: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly onInsert: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onInsert();
      }}
      className="text-ink-faint hover:bg-accent-soft hover:text-accent absolute top-[3px] right-[3px] flex size-[18px] cursor-pointer items-center justify-center rounded disabled:cursor-not-allowed disabled:opacity-35"
    >
      <Plus className="size-3" aria-hidden="true" />
    </button>
  );
}

function FavoriteButton({
  blockId,
  label,
  active,
  onToggle,
}: {
  readonly blockId: string;
  readonly label: string;
  readonly active: boolean;
  readonly onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      data-testid={`library-fav-${blockId}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(blockId);
      }}
      className={`absolute top-[3px] right-[22px] flex size-[18px] cursor-pointer items-center justify-center rounded transition-colors ${
        active ? 'text-sun' : 'text-ink-faint opacity-60 hover:opacity-100'
      }`}
    >
      <Star className={`size-2.5 ${active ? 'fill-current' : ''}`} aria-hidden="true" />
    </button>
  );
}

export type BlockItemProps = {
  readonly block: LibraryBlock;
  readonly disabled: boolean;
  readonly dragDisabled?: boolean | undefined;
  readonly uiKit?: UiKitReport | undefined;
  readonly isFavorite: boolean;
  readonly onToggleFavorite: (blockId: string) => void;
  readonly onPreview: PreviewHandler;
  readonly onSelect: (block: LibraryBlock, variantId?: string) => void;
};

function BlockItemBody({
  block,
  label,
  usesKit,
  kitBadgeLabel,
}: {
  readonly block: LibraryBlock;
  readonly label: string;
  readonly usesKit: boolean;
  readonly kitBadgeLabel: string;
}) {
  return (
    <>
      <BlockIcon name={block.icon} className="text-ink-soft size-[18px]" />
      <span className="text-ink max-w-full text-[11px] leading-tight break-words">{label}</span>
      {usesKit && (
        <span
          data-testid={`library-kit-badge-${block.id}`}
          className="bg-accent/10 text-accent rounded px-1 py-0.5 text-[9px] leading-none font-medium"
        >
          {kitBadgeLabel}
        </span>
      )}
    </>
  );
}

function BlockItemActions({
  block,
  label,
  disabled,
  selectedVariant,
  isFavorite,
  onSelectVariant,
  onToggleFavorite,
  onSelect,
}: {
  readonly block: LibraryBlock;
  readonly label: string;
  readonly disabled: boolean;
  readonly selectedVariant: string | undefined;
  readonly isFavorite: boolean;
  readonly onSelectVariant: (next: string | undefined) => void;
  readonly onToggleFavorite: (blockId: string) => void;
  readonly onSelect: (block: LibraryBlock, variantId?: string) => void;
}) {
  const { t } = useTranslation('library');
  return (
    <>
      <LibraryVariantMenu
        block={block}
        blockLabel={label}
        selectedVariant={selectedVariant}
        onSelectVariant={onSelectVariant}
      />
      <FavoriteButton
        blockId={block.id}
        label={t(isFavorite ? 'favoriteRemove' : 'favoriteAdd', { name: label })}
        active={isFavorite}
        onToggle={onToggleFavorite}
      />
      <InsertButton
        testId={`library-add-${block.id}`}
        label={t('add', { name: label })}
        disabled={disabled}
        onInsert={() => {
          onSelect(block, selectedVariant);
        }}
      />
    </>
  );
}

function buildBlockTileHandlers(
  block: LibraryBlock,
  label: string,
  dragDisabled: boolean | undefined,
  selectedVariant: string | undefined,
  onPreview: PreviewHandler,
) {
  return {
    onDragStart: (e: React.DragEvent<HTMLDivElement>) => {
      onPreview(undefined);
      handleBlockDragStart(e, block, dragDisabled, selectedVariant);
    },
    onDragEnd: handleBlockDragEnd,
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
      onPreview(block, label, previewAnchorOf(e.currentTarget));
    },
    onMouseLeave: () => {
      onPreview(undefined);
    },
    onFocus: (e: React.FocusEvent<HTMLDivElement>) => {
      onPreview(block, label, previewAnchorOf(e.currentTarget));
    },
    onBlur: () => {
      onPreview(undefined);
    },
  };
}

export function BlockItem({
  block,
  disabled,
  dragDisabled,
  uiKit,
  isFavorite,
  onToggleFavorite,
  onPreview,
  onSelect,
}: BlockItemProps) {
  const { t } = useTranslation('library');
  const rawKey = block.labelKey.replace(/^library:blocks\./, '');
  const label = isBlockKey(rawKey) ? t(`blocks.${rawKey}`) : block.id;
  const [selectedVariant, setSelectedVariantState] = useState<string | undefined>(() =>
    getSelectedVariant(block.id),
  );
  const handlers = buildBlockTileHandlers(block, label, dragDisabled, selectedVariant, onPreview);

  return (
    <div
      data-testid={`library-block-${block.id}`}
      draggable={!dragDisabled}
      {...handlers}
      className="border-line bg-card-solid hover:border-border hover:bg-field relative flex min-w-0 cursor-grab flex-col items-center gap-1 rounded-[7px] border px-1 pt-5 pb-2 text-center transition-colors outline-none focus-within:ring-1 active:cursor-grabbing"
    >
      <BlockItemActions
        block={block}
        label={label}
        disabled={disabled}
        selectedVariant={selectedVariant}
        isFavorite={isFavorite}
        onSelectVariant={(next) => {
          setSelectedVariant(block.id, next);
          setSelectedVariantState(next);
        }}
        onToggleFavorite={onToggleFavorite}
        onSelect={onSelect}
      />
      <BlockItemBody
        block={block}
        label={label}
        usesKit={supportsUiKitBlock(block.id, uiKit)}
        kitBadgeLabel={t('fromProject')}
      />
    </div>
  );
}
