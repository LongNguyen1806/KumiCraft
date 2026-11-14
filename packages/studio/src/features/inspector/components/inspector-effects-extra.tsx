// Extended Inspector Effects UI: gradient, gradient text, colored shadow, glow, backdrop blur, transform, filter (K9.7-2 TK-12..14).
import type { PropertyId } from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

import { type EffectsCommonProps, GradientControls } from './effects-gradient.tsx';
import {
  BACKDROP_BLUR_OPTIONS,
  colorToTwValue,
  FILTER_FIELDS,
  GLOW_CSS_SHADOW,
  GLOW_TW_SHADOW,
  GRADIENT_COLORS,
  MIX_BLEND_MODES,
  readCssPropVal,
  readTwTokenStr,
  TRANSFORM_FIELDS,
} from './effects-helpers.ts';

export type { EffectsCommonProps };

function BackdropBlurField({
  shared,
  blurVal,
}: {
  readonly shared: EffectsCommonProps;
  readonly blurVal: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-ink-faint">{t('inspector.effects.backdropBlur')}</span>
      <select
        data-testid="effect-backdrop-blur"
        disabled={shared.disabled}
        value={blurVal}
        onChange={(e) => {
          const opt = BACKDROP_BLUR_OPTIONS.find(
            (o) => o.tw === e.target.value || o.css === e.target.value,
          );
          if (shared.editable && shared.onPropChange !== undefined) {
            shared.onPropChange('backdropBlur', opt ? { kind: 'scale', token: opt.tw } : undefined);
          } else {
            void shared.onCssCommit?.('backdropBlur', opt?.css ?? '');
          }
        }}
        className="h-7 rounded border border-line bg-card-solid px-1.5 text-xs text-ink"
      >
        <option value="">—</option>
        {BACKDROP_BLUR_OPTIONS.map((o) => (
          <option key={o.tw} value={shared.editable ? o.tw : o.css}>
            {o.tw}
          </option>
        ))}
      </select>
    </div>
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
  const blurVal = shared.editable
    ? readTwTokenStr(tokens, scope, 'backdropBlur')
    : readCssPropVal(shared.cssReading, 'backdropBlur');
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
    <div className="grid grid-cols-2 gap-1.5 border-t border-line pt-2">
      <BackdropBlurField shared={shared} blurVal={blurVal} />
      <GlowRow
        shared={shared}
        isGlow={isGlow}
        shadowColorVal={shadowColorVal}
        onToggleGlow={toggleGlow}
      />
    </div>
  );
}

type CompositeFieldLabelKey =
  (typeof TRANSFORM_FIELDS)[number]['labelKey'] | (typeof FILTER_FIELDS)[number]['labelKey'];

function CompositeSelectField({
  shared,
  prop,
  labelKey,
  items,
}: {
  readonly shared: EffectsCommonProps;
  readonly prop: PropertyId;
  readonly labelKey: CompositeFieldLabelKey;
  readonly items: readonly { readonly tw: string; readonly css: string }[];
}) {
  const { t } = useTranslation();
  const scope = shared.currentScope ?? { breakpoint: 'base' };
  const val = shared.editable
    ? readTwTokenStr(shared.tokens ?? [], scope, prop)
    : readCssPropVal(shared.cssReading, prop);

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-ink-faint">{t(labelKey)}</span>
      <select
        data-testid={`effect-field-${prop}`}
        disabled={shared.disabled}
        value={val}
        onChange={(e) => {
          const picked = items.find((i) => i.tw === e.target.value || i.css === e.target.value);
          if (shared.editable && shared.onPropChange !== undefined) {
            shared.onPropChange(prop, picked ? { kind: 'scale', token: picked.tw } : undefined);
          } else {
            void shared.onCssCommit?.(prop, picked?.css ?? '');
          }
        }}
        className="h-7 rounded border border-line bg-card-solid px-1.5 text-xs text-ink"
      >
        <option value="">—</option>
        {items.map((item) => (
          <option key={item.tw} value={shared.editable ? item.tw : item.css}>
            {item.tw}
          </option>
        ))}
      </select>
    </label>
  );
}

function TransformAndFilterGrid({ shared }: { readonly shared: EffectsCommonProps }) {
  const { t } = useTranslation();
  const scope = shared.currentScope ?? { breakpoint: 'base' };
  const blendVal = shared.editable
    ? readTwTokenStr(shared.tokens ?? [], scope, 'mixBlendMode')
    : readCssPropVal(shared.cssReading, 'mixBlendMode');

  return (
    <div className="grid grid-cols-2 gap-1.5 border-t border-line pt-2">
      {TRANSFORM_FIELDS.map((f) => (
        <CompositeSelectField
          key={f.prop}
          shared={shared}
          prop={f.prop}
          labelKey={f.labelKey}
          items={f.items}
        />
      ))}
      {FILTER_FIELDS.map((f) => (
        <CompositeSelectField
          key={f.prop}
          shared={shared}
          prop={f.prop}
          labelKey={f.labelKey}
          items={f.items}
        />
      ))}
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
