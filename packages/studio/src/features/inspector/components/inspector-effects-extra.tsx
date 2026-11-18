// Extended Inspector Effects UI: gradient, gradient text, colored shadow, glow, backdrop blur, transform, filter (K9.7-2 TK-12..14).
// The numbers are a slider and a typed value (the owner, 2026-11-18), not a list of a few.
import { useTranslation } from 'react-i18next';

import { NUMERIC_FIELDS, type NumericField } from '../numeric-fields.ts';
import { type EffectsCommonProps, GradientControls } from './effects-gradient.tsx';
import {
  colorToTwValue,
  GLOW_CSS_SHADOW,
  GLOW_TW_SHADOW,
  GRADIENT_COLORS,
  MIX_BLEND_MODES,
  readCssPropVal,
  readTwTokenStr,
} from './effects-helpers.ts';
import { SliderNumberField } from './slider-number-field.tsx';
import { useNumericProp } from './use-numeric-prop.ts';

export type { EffectsCommonProps };

/** One number field of the Effects group: a slider and a typed value (the owner, 2026-11-18). */
function EffectNumberField({
  shared,
  field,
  labelKey,
  testId,
}: {
  readonly shared: EffectsCommonProps;
  readonly field: NumericField;
  readonly labelKey: EffectNumberLabelKey;
  readonly testId: string;
}) {
  const { t } = useTranslation();
  const p = useNumericProp(shared, field);
  return (
    <SliderNumberField
      field={field}
      label={t(labelKey)}
      testId={testId}
      value={p.value}
      raw={p.raw}
      disabled={shared.disabled}
      onPreview={p.onPreview}
      onPreviewEnd={p.onPreviewEnd}
      onCommit={p.onCommit}
    />
  );
}

function GlowRow({
  shared,
  isGlow,
  shadowColorVal,
  onToggleGlow,
}: {
  readonly shared: EffectsCommonProps;
  readonly isGlow: boolean;
  readonly shadowColorVal: string;
  readonly onToggleGlow: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-ink-faint">{t('inspector.effects.glow')}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-testid="effect-glow-toggle"
          disabled={shared.disabled}
          onClick={onToggleGlow}
          className={`h-7 flex-1 rounded px-2 text-[11px] font-medium ${isGlow ? 'bg-accent text-white' : 'border border-line bg-card-solid text-ink'}`}
        >
          {t('inspector.effects.glowButton')}
        </button>
        {shared.editable && (
          <select
            data-testid="effect-shadow-color"
            aria-label={t('inspector.fields.shadowColor')}
            disabled={shared.disabled}
            value={shadowColorVal}
            onChange={(e) => {
              const val = e.target.value;
              shared.onPropChange?.('shadowColor', val === '' ? undefined : colorToTwValue(val));
            }}
            className="h-7 w-14 rounded border border-line bg-card-solid px-1 text-[11px] text-ink"
          >
            <option value="">—</option>
            {GRADIENT_COLORS.slice(0, 7).map((c) => (
              <option key={c.id} value={c.id}>
                {c.id.split('-')[0]}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

function GlowAndGlassControls({ shared }: { readonly shared: EffectsCommonProps }) {
  const scope = shared.currentScope ?? { breakpoint: 'base' };
  const tokens = shared.tokens ?? [];
  const shadowColorVal = shared.editable ? readTwTokenStr(tokens, scope, 'shadowColor') : '';
  const boxShadowVal = shared.editable
    ? readTwTokenStr(tokens, scope, 'boxShadow')
    : readCssPropVal(shared.cssReading, 'boxShadow');
  const isGlow =
    boxShadowVal.includes('rgba(59,130,246') || boxShadowVal.includes('rgba(59, 130, 246');
  const toggleGlow = () => {
    if (shared.editable && shared.onPropChange !== undefined) {
      shared.onPropChange(
        'boxShadow',
        isGlow ? undefined : { kind: 'arbitrary', css: GLOW_TW_SHADOW },
      );
      return;
    }
    void shared.onCssCommit?.('boxShadow', isGlow ? '' : GLOW_CSS_SHADOW);
  };
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2">
      <EffectNumberField
        shared={shared}
        field={NUMERIC_FIELDS.backdropBlur}
        labelKey="inspector.effects.backdropBlur"
        testId="effect-backdrop-blur"
      />
      <GlowRow
        shared={shared}
        isGlow={isGlow}
        shadowColorVal={shadowColorVal}
        onToggleGlow={toggleGlow}
      />
    </div>
  );
}

type EffectNumberLabelKey =
  (typeof EFFECT_NUMBER_FIELDS)[number]['labelKey'] | 'inspector.effects.backdropBlur';

/** The transform and filter numbers, in the order the group shows them. */
const EFFECT_NUMBER_FIELDS = [
  { field: NUMERIC_FIELDS.rotate, labelKey: 'inspector.fields.rotate' },
  { field: NUMERIC_FIELDS.scale, labelKey: 'inspector.fields.scale' },
  { field: NUMERIC_FIELDS.translateX, labelKey: 'inspector.fields.translateX' },
  { field: NUMERIC_FIELDS.translateY, labelKey: 'inspector.fields.translateY' },
  { field: NUMERIC_FIELDS.skewX, labelKey: 'inspector.fields.skewX' },
  { field: NUMERIC_FIELDS.blur, labelKey: 'inspector.fields.blur' },
  { field: NUMERIC_FIELDS.brightness, labelKey: 'inspector.fields.brightness' },
  { field: NUMERIC_FIELDS.contrast, labelKey: 'inspector.fields.contrast' },
  { field: NUMERIC_FIELDS.grayscale, labelKey: 'inspector.fields.grayscale' },
] as const;

function MixBlendModeField({ shared }: { readonly shared: EffectsCommonProps }) {
  const { t } = useTranslation();
  const scope = shared.currentScope ?? { breakpoint: 'base' };
  const blendVal = shared.editable
    ? readTwTokenStr(shared.tokens ?? [], scope, 'mixBlendMode')
    : readCssPropVal(shared.cssReading, 'mixBlendMode');

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-ink-faint">{t('inspector.fields.mixBlendMode')}</span>
      <select
        data-testid="effect-field-mixBlendMode"
        disabled={shared.disabled}
        value={blendVal}
        onChange={(e) => {
          const v = e.target.value;
          if (shared.editable && shared.onPropChange !== undefined) {
            shared.onPropChange(
              'mixBlendMode',
              v === '' ? undefined : { kind: 'keyword', name: v },
            );
          } else {
            void shared.onCssCommit?.('mixBlendMode', v);
          }
        }}
        className="h-7 rounded border border-line bg-card-solid px-1.5 text-xs text-ink"
      >
        <option value="">—</option>
        {MIX_BLEND_MODES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </label>
  );
}

function TransformAndFilterGrid({ shared }: { readonly shared: EffectsCommonProps }) {
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2">
      {EFFECT_NUMBER_FIELDS.map((f) => (
        <EffectNumberField
          key={f.field.prop}
          shared={shared}
          field={f.field}
          labelKey={f.labelKey}
          testId={`effect-field-${f.field.prop}`}
        />
      ))}
      <MixBlendModeField shared={shared} />
    </div>
  );
}

export function InspectorEffectsExtra(props: EffectsCommonProps) {
  return (
    <div className="space-y-2 pt-1" data-testid="inspector-effects-extra">
      <GradientControls shared={props} />
      <GlowAndGlassControls shared={props} />
      <TransformAndFilterGrid shared={props} />
    </div>
  );
}
