// Color palette suggestion drawer/panel in Brand colors group (TK-70).
import {
  generatePalette,
  type PaletteSwatch,
  type ThemeEdit,
  type ThemeInfo,
  type ThemeToken,
} from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type BrandPaletteProps = {
  readonly existingColors: readonly ThemeToken[];
  readonly onApplyEdit: (edit: ThemeEdit) => Promise<ThemeInfo | undefined>;
};

async function applyPaletteSwatches(
  swatches: readonly PaletteSwatch[],
  existingColors: readonly ThemeToken[],
  onApplyEdit: (edit: ThemeEdit) => Promise<ThemeInfo | undefined>,
): Promise<void> {
  const known = new Set(existingColors.map((c) => c.name));
  for (const swatch of swatches) {
    const op = known.has(swatch.name) ? 'set' : 'add';
    const updated = await onApplyEdit({
      op,
      kind: 'color',
      name: swatch.name,
      value: swatch.value,
    });
    if (updated === undefined) break;
    known.add(swatch.name);
  }
}

function PaletteSwatchRow({ swatch }: { readonly swatch: PaletteSwatch }) {
  return (
    <div
      data-testid={`brand-palette-swatch-${swatch.name}`}
      className="flex items-center justify-between gap-2 rounded border border-line/70 bg-card-solid px-2 py-1"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="size-4 shrink-0 rounded border border-black/15"
          style={{ backgroundColor: swatch.value }}
        />
        <span className="truncate font-mono text-[11px] text-ink">{swatch.name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-[10px]">
        {swatch.contrastRatio !== undefined && (
          <span className="rounded bg-field px-1 py-0.5 font-mono text-ink-soft">
            {swatch.contrastRatio.toFixed(1)}:1
          </span>
        )}
        <span className="font-mono text-ink-faint">{swatch.value}</span>
      </div>
    </div>
  );
}

type BrandPaletteDrawerProps = {
  readonly seed: string;
  readonly swatches: readonly PaletteSwatch[];
  readonly applying: boolean;
  readonly onSeedChange: (value: string) => void;
  readonly onApply: () => void;
};

function BrandPaletteDrawer({
  seed,
  swatches,
  applying,
  onSeedChange,
  onApply,
}: BrandPaletteDrawerProps) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="brand-palette-panel"
      className="flex flex-col gap-2 rounded-md border border-border bg-field/60 p-2.5 text-xs"
    >
      <div className="flex items-center gap-2">
        <label htmlFor="brand-palette-seed" className="text-[11px] text-ink-soft">
          {t('brand.seedColor')}
        </label>
        <input
          id="brand-palette-seed"
          data-testid="brand-palette-seed"
          type="color"
          value={seed}
          onChange={(e) => {
            onSeedChange(e.target.value);
          }}
          className="h-6 w-8 cursor-pointer rounded border border-line bg-transparent p-0"
        />
        <span className="font-mono text-[11px] text-ink-faint">{seed}</span>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {swatches.map((swatch) => (
          <PaletteSwatchRow key={swatch.name} swatch={swatch} />
        ))}
      </div>
      <button
        type="button"
        data-testid="brand-palette-apply"
        disabled={applying}
        onClick={onApply}
        className="h-7 rounded-md bg-accent px-2.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
      >
        {applying ? t('brand.applyingPalette') : t('brand.applyPalette')}
      </button>
    </div>
  );
}

export function BrandPalettePanel({ existingColors, onApplyEdit }: BrandPaletteProps) {
  const { t } = useTranslation();
  const initialSeed =
    existingColors.find((c) => c.name === 'primary' || c.name === 'brand')?.value ?? '#2563eb';
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState(initialSeed.startsWith('#') ? initialSeed : '#2563eb');
  const [applying, setApplying] = useState(false);

  const palette = generatePalette(seed);

  const handleApply = async () => {
    setApplying(true);
    await applyPaletteSwatches(palette.swatches, existingColors, onApplyEdit);
    setApplying(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        data-testid="brand-palette-open"
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="self-start rounded border border-line bg-card-solid px-2 py-1 text-[11px] font-medium text-ink hover:bg-field cursor-pointer"
      >
        {t('brand.suggestPalette')}
      </button>
      {open && (
        <BrandPaletteDrawer
          seed={palette.seed}
          swatches={palette.swatches}
          applying={applying}
          onSeedChange={setSeed}
          onApply={() => {
            void handleApply();
          }}
        />
      )}
    </div>
  );
}
