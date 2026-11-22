// Variant picker button and dropdown menu on Library BlockItem (TK-47).
import type { LibraryBlock, LibraryBlockVariant } from '@kumicraft/content';
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  DEFAULT_VARIANT_KEYS,
  type VariantKey,
  variantKeyFromLabelKey,
} from './library-variants.ts';

type VariantOption = {
  readonly id: string;
  readonly label: string;
  readonly selected: boolean;
};

type LibraryVariantMenuProps = {
  readonly block: LibraryBlock;
  readonly blockLabel: string;
  readonly selectedVariant: string | undefined;
  readonly onSelectVariant: (variantId: string | undefined) => void;
};

function buildOptions(
  blockId: string,
  variants: readonly LibraryBlockVariant[],
  selectedVariant: string | undefined,
  t: (key: `variants.${VariantKey}`) => string,
): readonly VariantOption[] {
  const defaultKey = DEFAULT_VARIANT_KEYS[blockId] ?? 'solid';
  const items: VariantOption[] = [
    {
      id: 'default',
      label: t(`variants.${defaultKey}`),
      selected: selectedVariant === undefined,
    },
  ];
  for (const variant of variants) {
    const key = variantKeyFromLabelKey(variant.labelKey);
    items.push({
      id: variant.id,
      label: key !== undefined ? t(`variants.${key}`) : variant.id,
      selected: selectedVariant === variant.id,
    });
  }
  return items;
}

function useDismissMenu(
  open: boolean,
  containerRef: React.RefObject<HTMLDivElement | undefined>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return undefined;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        containerRef.current !== undefined &&
        !containerRef.current.contains(target)
      ) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, containerRef, onClose]);
}

function VariantMenuList({
  blockId,
  options,
  checkLabel,
  onPick,
}: {
  readonly blockId: string;
  readonly options: readonly VariantOption[];
  readonly checkLabel: string;
  readonly onPick: (variantId: string | undefined) => void;
}) {
  return (
    <div
      data-testid="library-variant-menu"
      role="menu"
      className="absolute top-5 left-0 z-20 min-w-[120px] rounded-md border border-line bg-card-solid py-1 text-left shadow-md"
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="menuitemradio"
          aria-checked={opt.selected}
          data-testid={`library-variant-${blockId}-${opt.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onPick(opt.id === 'default' ? undefined : opt.id);
          }}
          className="flex w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-1 text-[11px] text-ink hover:bg-field"
        >
          <span>{opt.label}</span>
          <span className="w-3 text-right text-accent">{opt.selected ? checkLabel : ''}</span>
        </button>
      ))}
    </div>
  );
}

function VariantMenuTrigger({
  blockId,
  label,
  open,
  onToggle,
}: {
  readonly blockId: string;
  readonly label: string;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`library-variant-${blockId}`}
      aria-label={label}
      title={label}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="flex size-[18px] cursor-pointer items-center justify-center rounded text-ink-faint hover:bg-accent-soft hover:text-accent"
    >
      <ChevronDown className="size-3" aria-hidden="true" />
    </button>
  );
}

export function LibraryVariantMenu({
  block,
  blockLabel,
  selectedVariant,
  onSelectVariant,
}: LibraryVariantMenuProps) {
  const { t } = useTranslation('library');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | undefined>(undefined);
  useDismissMenu(open, containerRef, () => {
    setOpen(false);
  });

  if (block.variants === undefined || block.variants.length === 0) return undefined;
  const options = buildOptions(block.id, block.variants, selectedVariant, (k) => t(k));

  return (
    <div
      ref={(el) => {
        containerRef.current = el ?? undefined;
      }}
      className="absolute top-[3px] left-[3px]"
    >
      <VariantMenuTrigger
        blockId={block.id}
        label={t('variantMenu', { name: blockLabel })}
        open={open}
        onToggle={() => {
          setOpen((prev) => !prev);
        }}
      />
      {open ? (
        <VariantMenuList
          blockId={block.id}
          options={options}
          checkLabel={t('variantCheck')}
          onPick={(next) => {
            onSelectVariant(next);
            setOpen(false);
          }}
        />
      ) : undefined}
    </div>
  );
}
