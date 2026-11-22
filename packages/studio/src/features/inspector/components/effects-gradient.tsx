// Gradient background & gradient text Inspector controls (K9.7-2 TK-10).
import type { StyleReading } from '@kumicraft/shared';
import type { ClassToken, ClassValue, PropertyId, Scope } from '@kumicraft/style-tailwind';
import { useTranslation } from 'react-i18next';

import { useSelectionStore } from '../../../core/selection-store.ts';
import type { BatchPropEntry } from '../use-live-edit.ts';
import {
  buildCssLinearGradient,
  colorToTwValue,
  GRADIENT_COLORS,
  GRADIENT_DIRS,
  parseCssLinearGradient,
  readCssPropVal,
  readTwTokenStr,
} from './effects-helpers.ts';

export type EffectsCommonProps = {
  readonly editable: boolean;
  readonly disabled: boolean;
  readonly tokens?: readonly ClassToken[] | undefined;
  readonly currentScope?: Scope | undefined;
  /** Tailwind 3 has fixed names where Tailwind 4 takes any number (`rotate-15`). */
  readonly major?: 3 | 4 | undefined;
  readonly onPropChange?: ((prop: PropertyId, value: ClassValue | undefined) => void) | undefined;
  readonly onBatchProps?: ((entries: readonly BatchPropEntry[]) => void) | undefined;
  readonly cssReading?: StyleReading | undefined;
  readonly onCssCommit?: ((property: string, value: string) => Promise<void> | void) | undefined;
};

type GradientState = {
  readonly enabled: boolean;
  readonly dir: string;
  readonly from: string;
  readonly via: string;
  readonly to: string;
  readonly isText: boolean;
};

function readGradientState(props: EffectsCommonProps): GradientState {
  const scope = props.currentScope ?? { breakpoint: 'base' };
  const tokens = props.tokens ?? [];
  if (props.editable) {
    const bgImg = readTwTokenStr(tokens, scope, 'backgroundImage');
    return {
      enabled: bgImg.startsWith('linear-'),
      dir: bgImg.startsWith('linear-') ? bgImg : 'linear-to-r',
      from: readTwTokenStr(tokens, scope, 'gradientFrom') || 'blue-500',
      via: readTwTokenStr(tokens, scope, 'gradientVia'),
      to: readTwTokenStr(tokens, scope, 'gradientTo') || 'purple-500',
      isText: readTwTokenStr(tokens, scope, 'backgroundClip') === 'text',
    };
  }
  const parsed = parseCssLinearGradient(readCssPropVal(props.cssReading, 'backgroundImage'));
  return {
    enabled: parsed.enabled,
    dir: parsed.dirCss,
    from: parsed.from,
    via: parsed.via,
    to: parsed.to,
    isText: readCssPropVal(props.cssReading, 'backgroundClip') === 'text',
  };
}

/**
 * The text color an element had before "Gradient text" made it transparent, by element, so turning
 * the gradient text off gives that color back (the owner's white button text came back black).
 */
const colorBeforeGradientText = new Map<
  string,
  { readonly tw?: ClassValue | undefined; readonly css?: string | undefined }
>();

const selectedLoc = (): string => useSelectionStore.getState().selectedRefs[0]?.loc ?? '';

/** The text color `textColor` should get: transparent while on, the remembered one once off. */
function textColorFor(next: GradientState, wasText: boolean, current: ClassValue | undefined) {
  const loc = selectedLoc();
  if (next.enabled && next.isText) {
    if (!wasText) colorBeforeGradientText.set(loc, { tw: current });
    return { change: true, value: { kind: 'keyword', name: 'transparent' } as const };
  }
  if (!wasText) return { change: false, value: undefined };
  const kept = colorBeforeGradientText.get(loc)?.tw;
  colorBeforeGradientText.delete(loc);
  return { change: true, value: kept };
}

function buildTwGradientBatch(
  next: GradientState,
  wasText: boolean,
  currentColor: ClassValue | undefined,
): readonly BatchPropEntry[] {
  const color = textColorFor(next, wasText, currentColor);
  const textEntries: BatchPropEntry[] = color.change
    ? [{ property: 'textColor', value: color.value }]
    : [];
  if (!next.enabled) {
    return [
      { property: 'backgroundImage', value: undefined },
      { property: 'gradientFrom', value: undefined },
      { property: 'gradientVia', value: undefined },
      { property: 'gradientTo', value: undefined },
      ...(wasText ? [{ property: 'backgroundClip' as const, value: undefined }] : []),
      ...textEntries,
    ];
  }
  return [
    { property: 'backgroundImage', value: { kind: 'keyword', name: next.dir } },
    { property: 'gradientFrom', value: colorToTwValue(next.from) },
    { property: 'gradientVia', value: next.via !== '' ? colorToTwValue(next.via) : undefined },
    { property: 'gradientTo', value: colorToTwValue(next.to) },
    {
      property: 'backgroundClip',
      value: next.isText ? { kind: 'keyword', name: 'text' } : undefined,
    },
    ...textEntries,
  ];
}

function formatGradDirLabel(d: (typeof GRADIENT_DIRS)[number]): string {
  return `${d.label} ${d.tw.replace('linear-', '')}`;
}

function GradientColorSelect({
  testId,
  ariaLabel,
  disabled,
  editable,
  value,
  onChange,
}: {
  readonly testId: string;
  readonly ariaLabel: string;
  readonly disabled: boolean;
  readonly editable: boolean;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <select
      data-testid={testId}
      aria-label={ariaLabel}
      disabled={disabled}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      className="h-7 rounded border border-line bg-card-solid px-1.5 text-xs text-ink"
    >
      {GRADIENT_COLORS.map((c) => (
        <option key={c.id} value={editable ? c.id : c.hex}>
          {c.id}
        </option>
      ))}
    </select>
  );
}

function GradientDirectionField({
  shared,
  state,
  onChange,
}: {
  readonly shared: EffectsCommonProps;
  readonly state: GradientState;
  readonly onChange: (next: GradientState) => void;
}) {
  const { t } = useTranslation();
  return (
    <select
      data-testid="effect-gradient-dir"
      aria-label={t('inspector.effects.direction')}
      disabled={shared.disabled}
      value={state.dir}
      onChange={(e) => {
        onChange({ ...state, dir: e.target.value });
      }}
      className="h-7 rounded border border-line bg-card-solid px-1.5 text-xs text-ink"
    >
      {GRADIENT_DIRS.map((d) => (
        <option key={d.tw} value={shared.editable ? d.tw : d.css}>
          {formatGradDirLabel(d)}
        </option>
      ))}
    </select>
  );
}

function GradientFields({
  shared,
  state,
  onChange,
}: {
  readonly shared: EffectsCommonProps;
  readonly state: GradientState;
  readonly onChange: (next: GradientState) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <GradientDirectionField shared={shared} state={state} onChange={onChange} />
      <label className="flex items-center gap-1.5 text-[11px] text-ink">
        <input
          type="checkbox"
          data-testid="effect-gradient-text"
          disabled={shared.disabled}
          checked={state.isText}
          onChange={(e) => {
            onChange({ ...state, isText: e.target.checked });
          }}
        />
        <span>{t('inspector.effects.gradientText')}</span>
      </label>
      <GradientColorSelect
        testId="effect-gradient-from"
        ariaLabel={t('inspector.effects.from')}
        disabled={shared.disabled}
        editable={shared.editable}
        value={state.from}
        onChange={(v) => {
          onChange({ ...state, from: v });
        }}
      />
      <GradientColorSelect
        testId="effect-gradient-to"
        ariaLabel={t('inspector.effects.to')}
        disabled={shared.disabled}
        editable={shared.editable}
        value={state.to}
        onChange={(v) => {
          onChange({ ...state, to: v });
        }}
      />
    </div>
  );
}

/** Plain CSS: the gradient as `background-image`, and the text color kept around gradient text. */
async function applyCssGradient(
  shared: EffectsCommonProps,
  next: GradientState,
  wasText: boolean,
): Promise<void> {
  const gradVal = next.enabled
    ? buildCssLinearGradient(next.dir, next.from, next.via, next.to)
    : '';
  await shared.onCssCommit?.('backgroundImage', gradVal);
  const textOn = next.enabled && next.isText;
  if (textOn !== wasText) {
    const loc = selectedLoc();
    if (textOn) {
      const before = readCssPropVal(shared.cssReading, 'textColor');
      colorBeforeGradientText.set(loc, { css: before });
    }
    const back = colorBeforeGradientText.get(loc)?.css ?? '';
    if (!textOn) colorBeforeGradientText.delete(loc);
    await shared.onCssCommit?.('backgroundClip', textOn ? 'text' : '');
    await shared.onCssCommit?.('textColor', textOn ? 'transparent' : back);
  }
}

export function GradientControls({ shared }: { readonly shared: EffectsCommonProps }) {
  const { t } = useTranslation();
  const state = readGradientState(shared);

  const applyGradient = (next: GradientState) => {
    if (shared.editable && shared.onBatchProps !== undefined) {
      const current = (shared.tokens ?? []).find(
        (tk) => tk.property === 'textColor' && tk.variants.length === 0,
      )?.value;
      shared.onBatchProps(buildTwGradientBatch(next, state.isText, current));
      return;
    }
    void applyCssGradient(shared, next, state.isText);
  };

  return (
    <div className="space-y-1.5 border-t border-line pt-2" data-testid="effects-gradient-section">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-ink-soft">
          {t('inspector.effects.gradient')}
        </span>
        <button
          type="button"
          data-testid="effect-gradient-toggle"
          disabled={shared.disabled}
          onClick={() => {
            applyGradient({ ...state, enabled: !state.enabled });
          }}
          className={`rounded px-2 py-0.5 text-[11px] font-medium ${state.enabled ? 'bg-accent text-white' : 'border border-line bg-card-solid text-ink'}`}
        >
          {state.enabled ? t('inspector.effects.on') : t('inspector.effects.off')}
        </button>
      </div>
      {state.enabled && <GradientFields shared={shared} state={state} onChange={applyGradient} />}
    </div>
  );
}
