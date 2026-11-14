// Gradient background & gradient text Inspector controls (K9.7-2 TK-10).
import type { ClassToken, ClassValue, PropertyId, Scope, StyleReading } from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

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

function buildTwGradientBatch(next: GradientState, wasText: boolean): readonly BatchPropEntry[] {
  if (!next.enabled) {
    return [
      { property: 'backgroundImage', value: undefined },
      { property: 'gradientFrom', value: undefined },
      { property: 'gradientVia', value: undefined },
      { property: 'gradientTo', value: undefined },
      ...(wasText
        ? [
            { property: 'backgroundClip' as const, value: undefined },
            { property: 'textColor' as const, value: undefined },
          ]
        : []),
    ];
  }
  const textEntries: BatchPropEntry[] = next.isText
    ? [{ property: 'textColor', value: { kind: 'keyword', name: 'transparent' } }]
    : wasText
      ? [{ property: 'textColor', value: undefined }]
      : [];
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

export function GradientControls({ shared }: { readonly shared: EffectsCommonProps }) {
  const { t } = useTranslation();
  const state = readGradientState(shared);

  const applyGradient = (next: GradientState) => {
    if (shared.editable && shared.onBatchProps !== undefined) {
      shared.onBatchProps(buildTwGradientBatch(next, state.isText));
      return;
    }
    const runCss = async () => {
      const gradVal = next.enabled
        ? buildCssLinearGradient(next.dir, next.from, next.via, next.to)
        : '';
      await shared.onCssCommit?.('backgroundImage', gradVal);
      if (next.isText !== state.isText) {
        await shared.onCssCommit?.('backgroundClip', next.isText ? 'text' : '');
        await shared.onCssCommit?.('textColor', next.isText ? 'transparent' : '');
      }
    };
    void runCss();
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
