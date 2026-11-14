// Curated Google Font pairs suggestion panel in Brand fonts group (TK-71).
import {
  GOOGLE_FONT_PAIRS,
  type GoogleFontFamily,
  type GoogleFontPair,
  type ThemeEdit,
  type ThemeInfo,
  type ThemeToken,
} from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const SERIF_FONTS = new Set<GoogleFontFamily>(['Playfair Display', 'DM Serif Display', 'Lora']);

function fontStack(family: GoogleFontFamily): string {
  const generic = SERIF_FONTS.has(family) ? 'serif' : 'sans-serif';
  return family.includes(' ') ? `'${family}', ${generic}` : `${family}, ${generic}`;
}

type BrandFontPairsProps = {
  readonly existingFonts: readonly ThemeToken[];
  readonly onApplyEdit: (edit: ThemeEdit) => Promise<ThemeInfo | undefined>;
};

async function applyFontPairEdits(
  pair: GoogleFontPair,
  existingFonts: readonly ThemeToken[],
  onApplyEdit: (edit: ThemeEdit) => Promise<ThemeInfo | undefined>,
): Promise<void> {
  const families =
    pair.heading === pair.body ? [pair.heading] : ([pair.heading, pair.body] as const);
  const imported = await onApplyEdit({ op: 'importFont', families });
  if (imported === undefined) return;

  const known = new Set(existingFonts.map((f) => f.name));
  const afterHeading = await onApplyEdit({
    op: known.has('heading') ? 'set' : 'add',
    kind: 'font',
    name: 'heading',
    value: fontStack(pair.heading),
  });
  if (afterHeading === undefined) return;

  await onApplyEdit({
    op: known.has('body') ? 'set' : 'add',
    kind: 'font',
    name: 'body',
    value: fontStack(pair.body),
  });
}

function BrandFontPairRow({
  pair,
  disabled,
  applyLabel,
  sampleLabel,
  onApply,
}: {
  readonly pair: GoogleFontPair;
  readonly disabled: boolean;
  readonly applyLabel: string;
  readonly sampleLabel: string;
  readonly onApply: () => void;
}) {
  return (
    <div
      data-testid={`brand-font-pair-${pair.id}`}
      className="flex items-center justify-between gap-2 rounded border border-line/70 bg-card-solid px-2.5 py-1.5"
    >
      <div className="min-w-0">
        <div
          className="truncate text-xs font-semibold text-ink"
          style={{ fontFamily: fontStack(pair.heading) }}
        >
          {pair.heading}
        </div>
        <div
          className="truncate text-[11px] text-ink-soft"
          style={{ fontFamily: fontStack(pair.body) }}
        >
          {sampleLabel}
        </div>
      </div>
      <button
        type="button"
        data-testid={`brand-font-apply-${pair.id}`}
        disabled={disabled}
        onClick={onApply}
        className="shrink-0 rounded border border-line bg-field px-2 py-1 text-[11px] font-medium text-ink hover:bg-card disabled:opacity-50 cursor-pointer"
      >
        {applyLabel}
      </button>
    </div>
  );
}

export function BrandFontPairsPanel({ existingFonts, onApplyEdit }: BrandFontPairsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [applyingId, setApplyingId] = useState<string | undefined>(undefined);

  const handleApplyPair = async (pair: GoogleFontPair) => {
    setApplyingId(pair.id);
    await applyFontPairEdits(pair, existingFonts, onApplyEdit);
    setApplyingId(undefined);
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        data-testid="brand-fonts-open"
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="self-start rounded border border-line bg-card-solid px-2 py-1 text-[11px] font-medium text-ink hover:bg-field cursor-pointer"
      >
        {t('brand.suggestFonts')}
      </button>

      {open && (
        <div
          data-testid="brand-fonts-panel"
          className="flex flex-col gap-1.5 rounded-md border border-border bg-field/60 p-2 text-xs"
        >
          {GOOGLE_FONT_PAIRS.map((pair) => (
            <BrandFontPairRow
              key={pair.id}
              pair={pair}
              disabled={applyingId !== undefined}
              applyLabel={t('brand.applyFontPair')}
              sampleLabel={t('brand.fontSample', { body: pair.body })}
              onApply={() => {
                void handleApplyPair(pair);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
