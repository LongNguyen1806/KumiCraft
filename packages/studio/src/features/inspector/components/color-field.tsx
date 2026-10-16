// Color field control in Inspector: project colors, Tailwind palette, and custom color picker (R-IN-19).
import type { ClassContext, ClassToken, ClassValue, PropertyId, Scope } from '@reactcraft/shared';
import { readValue, TAILWIND_COLORS } from '@reactcraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PropertyHeader } from './property-field.tsx';

export type ColorFieldProps = {
  readonly property: PropertyId;
  readonly label: string;
  readonly tokens: readonly ClassToken[];
  readonly currentScope: Scope;
  readonly frameWidth: number;
  readonly ctx: ClassContext;
  readonly onValueChange: (property: PropertyId, value: ClassValue | undefined) => void;
  readonly disabled?: boolean | undefined;
};

export function isValidColorString(val: string): boolean {
  const v = val.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) {
    return true;
  }
  if (/^(rgb|rgba|hsl|oklch)\([^)]+\)$/.test(v)) {
    return true;
  }
  return false;
}

function formatColorDisplayValue(value: ClassValue | undefined): string {
  if (value === undefined) return '—';
  if (value.kind === 'theme') return value.name;
  if (value.kind === 'scale') return value.token;
  if (value.kind === 'arbitrary') return `[${value.css}]`;
  return '—';
}

function resolveSwatchColor(
  value: ClassValue | undefined,
  themeColors: readonly { readonly name: string; readonly value: string }[],
): string | undefined {
  if (value === undefined) return undefined;
  if (value.kind === 'theme') {
    const found = themeColors.find((c) => c.name === value.name);
    return found?.value;
  }
  if (value.kind === 'scale') {
    const found = TAILWIND_COLORS.find((c) => c.name === value.token);
    return found?.value;
  }
  if (value.kind === 'arbitrary') {
    return value.css;
  }
  return undefined;
}

function ColorSwatch({ swatchColor }: { readonly swatchColor?: string | undefined }) {
  if (swatchColor !== undefined) {
    return (
      <span
        className="size-3.5 rounded border border-border/80 shrink-0"
        style={{ backgroundColor: swatchColor }}
      />
    );
  }
  return (
    <span className="size-3.5 rounded border border-border/80 shrink-0 relative overflow-hidden bg-field-hover">
      <span className="absolute inset-0 m-auto h-[1.5px] w-full bg-rose-500/70 rotate-45" />
    </span>
  );
}

function ProjectColorsSection({
  colors,
  onSelect,
}: {
  readonly colors: readonly { readonly name: string; readonly value: string }[];
  readonly onSelect: (name: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-ink-soft">{t('inspector.color.project')}</span>
      {colors.length === 0 ? (
        <div className="text-xs text-ink-faint italic">{t('inspector.color.noProjectColors')}</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {colors.map((c) => (
            <button
              key={c.name}
              type="button"
              data-testid={`color-option-theme-${c.name}`}
              title={c.name}
              style={{ backgroundColor: c.value }}
              onClick={() => {
                onSelect(c.name);
              }}
              className="size-5 rounded border border-border hover:scale-110 transition-transform"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TailwindPaletteSection({ onSelect }: { readonly onSelect: (name: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-ink-soft">{t('inspector.color.palette')}</span>
      <div className="flex max-h-36 flex-wrap gap-1 overflow-y-auto">
        {TAILWIND_COLORS.map((c) => (
          <button
            key={c.name}
            type="button"
            data-testid={`color-option-palette-${c.name}`}
            title={c.name}
            style={{ backgroundColor: c.value }}
            onClick={() => {
              onSelect(c.name);
            }}
            className="size-5 rounded border border-border hover:scale-110 transition-transform"
          />
        ))}
      </div>
    </div>
  );
}

function CustomColorSection({ onApply }: { readonly onApply: (css: string) => void }) {
  const { t } = useTranslation();
  const [customInput, setCustomInput] = useState('');
  const [hasError, setHasError] = useState(false);

  const handleApply = () => {
    const trimmed = customInput.trim();
    if (isValidColorString(trimmed)) {
      onApply(trimmed);
      setHasError(false);
    } else {
      setHasError(true);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-ink-soft">{t('inspector.color.custom')}</span>
      <div className="flex gap-1">
        <input
          type="text"
          data-testid="color-custom-input"
          value={customInput}
          onChange={(e) => {
            setCustomInput(e.target.value);
            setHasError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleApply();
            }
          }}
          className="h-7 min-w-0 flex-1 rounded border border-border/60 bg-field px-2 font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="button"
          data-testid="color-custom-apply"
          onClick={handleApply}
          className="h-7 shrink-0 rounded bg-field-hover px-2 text-xs font-medium text-ink hover:bg-border"
        >
          {t('inspector.color.apply')}
        </button>
      </div>
      {hasError && (
        <div role="alert" className="text-xs text-rose-500">
          {t('inspector.color.invalid')}
        </div>
      )}
    </div>
  );
}

function ColorPickerPopover({
  property,
  themeColors,
  onValueChange,
  onClose,
}: {
  readonly property: PropertyId;
  readonly themeColors: readonly { readonly name: string; readonly value: string }[];
  readonly onValueChange: (property: PropertyId, value: ClassValue | undefined) => void;
  readonly onClose: () => void;
}) {
  return (
    <div className="mt-1 flex flex-col gap-2 rounded border border-border bg-card p-2 shadow-md">
      <ProjectColorsSection
        colors={themeColors}
        onSelect={(name) => {
          onValueChange(property, { kind: 'theme', name });
          onClose();
        }}
      />
      <TailwindPaletteSection
        onSelect={(token) => {
          onValueChange(property, { kind: 'scale', token });
          onClose();
        }}
      />
      <CustomColorSection
        onApply={(css) => {
          onValueChange(property, { kind: 'arbitrary', css });
        }}
      />
    </div>
  );
}

function ColorTriggerButton({
  property,
  disabled,
  displayValue,
  swatchColor,
  onClick,
}: {
  readonly property: PropertyId;
  readonly disabled: boolean;
  readonly displayValue: string;
  readonly swatchColor?: string | undefined;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      id={`field-${property}`}
      data-testid={`color-field-${property}`}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-full items-center gap-2 rounded border border-border/60 bg-field px-2 text-xs text-ink hover:bg-field-hover focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
    >
      <ColorSwatch swatchColor={swatchColor} />
      <span className="truncate">{displayValue}</span>
    </button>
  );
}

function useColorFieldState(
  tokens: readonly ClassToken[],
  property: PropertyId,
  currentScope: Scope,
  frameWidth: number,
  ctx: ClassContext,
) {
  const read = readValue(tokens, property, { width: frameWidth, state: currentScope.state }, ctx);
  const isInherited =
    read.from !== undefined &&
    (read.from.breakpoint !== currentScope.breakpoint || read.from.state !== currentScope.state);
  const canRemoveOverride =
    !isInherited && currentScope.breakpoint !== 'base' && read.value !== undefined;
  const displayValue = formatColorDisplayValue(read.value);
  const swatchColor = resolveSwatchColor(read.value, ctx.theme.colors);
  return { read, isInherited, canRemoveOverride, displayValue, swatchColor };
}

export function ColorField(props: ColorFieldProps) {
  const {
    property,
    label,
    tokens,
    currentScope,
    frameWidth,
    ctx,
    onValueChange,
    disabled = false,
  } = props;
  const [open, setOpen] = useState(false);
  const state = useColorFieldState(tokens, property, currentScope, frameWidth, ctx);

  return (
    <div className="flex flex-col gap-1 py-1" data-testid={`property-field-${property}`}>
      <PropertyHeader
        property={property}
        label={label}
        isInherited={state.isInherited}
        canRemoveOverride={state.canRemoveOverride}
        fromScope={state.read.from}
        disabled={disabled}
        onRemoveOverride={() => {
          onValueChange(property, undefined);
        }}
      />
      <ColorTriggerButton
        property={property}
        disabled={disabled}
        displayValue={state.displayValue}
        swatchColor={state.swatchColor}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
      />
      {open && !disabled && (
        <ColorPickerPopover
          property={property}
          themeColors={ctx.theme.colors}
          onValueChange={onValueChange}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
