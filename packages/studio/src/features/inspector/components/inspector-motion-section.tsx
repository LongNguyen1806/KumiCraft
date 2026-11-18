// Inspector Motion & Scroll Reveal section (transition, animation, presets, preview, Reveal.tsx) (K9.7-2 TK-16..22).
import type {
  ClassToken,
  ClassValue,
  ElementRef,
  ElementSource,
  PropertyId,
  Scope,
  StyleReading,
  StyleState,
} from '@kumicraft/shared';
import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { studioBridgeChannel } from '../../selection/bridge-channel.ts';
import { NUMERIC_FIELDS } from '../numeric-fields.ts';
import type { BatchPropEntry } from '../use-live-edit.ts';
import { readCssPropVal, readTwTokenStr } from './effects-helpers.ts';
import { InspectorGroup } from './inspector-group.tsx';
import {
  ANIMATION_VALUES,
  CSS_ANIMATION_MAP,
  CSS_EASE_MAP,
  CSS_TRANSITION_MAP,
  cssClearSteps,
  EASE_VALUES,
  MOTION_PRESETS,
  type MotionPresetId,
  presetShown,
  TRANSITION_PROPS,
  twPresetEntries,
} from './motion-presets.ts';
import { MotionSelectField, RevealControls, useRevealWrapped } from './motion-reveal.tsx';
import { SliderNumberField } from './slider-number-field.tsx';
import { type NumericPropSource, useNumericProp } from './use-numeric-prop.ts';

export type InspectorMotionSectionProps = {
  readonly refTarget: ElementRef;
  readonly source: ElementSource;
  readonly editable: boolean;
  readonly disabled: boolean;
  readonly tokens?: readonly ClassToken[] | undefined;
  readonly currentScope?: Scope | undefined;
  readonly onPropChange?: ((prop: PropertyId, value: ClassValue | undefined) => void) | undefined;
  readonly onBatchProps?: ((entries: readonly BatchPropEntry[]) => void) | undefined;
  readonly cssReading?: StyleReading | undefined;
  readonly onCssCommit?:
    | ((property: string, value: string, stateOverride?: StyleState) => Promise<void> | void)
    | undefined;
  readonly onRefresh: () => void;
  /** Tailwind 3 has fixed durations where Tailwind 4 takes any (`duration-400`). */
  readonly major?: 3 | 4 | undefined;
};

/** Duration and delay: a slider and a typed value in ms (the owner, 2026-11-18). */
function TransitionTimingFields({
  source,
  disabled,
}: {
  readonly source: NumericPropSource;
  readonly disabled: boolean;
}) {
  const { t } = useTranslation();
  const duration = useNumericProp(source, NUMERIC_FIELDS.duration);
  const delay = useNumericProp(source, NUMERIC_FIELDS.delay);
  return (
    <>
      <SliderNumberField
        field={NUMERIC_FIELDS.duration}
        label={t('inspector.fields.duration')}
        testId="motion-duration"
        disabled={disabled}
        {...duration}
      />
      <SliderNumberField
        field={NUMERIC_FIELDS.delay}
        label={t('inspector.fields.delay')}
        testId="motion-delay"
        disabled={disabled}
        {...delay}
      />
    </>
  );
}

function TransitionCurveSelects({
  editable,
  disabled,
  readVal,
  commitProp,
}: {
  readonly editable: boolean;
  readonly disabled: boolean;
  readonly readVal: (prop: PropertyId) => string;
  readonly commitProp: (prop: PropertyId, twVal: string, cssVal: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <MotionSelectField
        testId="motion-transition-prop"
        label={t('inspector.fields.transitionProperty')}
        disabled={disabled}
        value={readVal('transitionProperty')}
        options={TRANSITION_PROPS.map((v) => ({
          value: editable ? v : (CSS_TRANSITION_MAP[v] ?? v),
          label: v,
        }))}
        onChange={(v) => {
          commitProp('transitionProperty', v, CSS_TRANSITION_MAP[v] ?? '');
        }}
      />
      <MotionSelectField
        testId="motion-ease"
        label={t('inspector.fields.ease')}
        disabled={disabled}
        value={readVal('ease')}
        options={EASE_VALUES.map((v) => ({
          value: editable ? v : (CSS_EASE_MAP[v] ?? v),
          label: v,
        }))}
        onChange={(v) => {
          const tw = Object.entries(CSS_EASE_MAP).find(([, c]) => c === v)?.[0] ?? v;
          commitProp('ease', tw, CSS_EASE_MAP[v] ?? v);
        }}
      />
    </>
  );
}

function TransitionGrid(props: {
  readonly editable: boolean;
  readonly disabled: boolean;
  readonly readVal: (prop: PropertyId) => string;
  readonly commitProp: (prop: PropertyId, twVal: string, cssVal: string) => void;
  readonly source: NumericPropSource;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-1.5">
        <TransitionCurveSelects {...props} />
      </div>
      <TransitionTimingFields source={props.source} disabled={props.disabled} />
    </div>
  );
}

function AnimationField({
  editable,
  disabled,
  animVal,
  onChangeAnim,
}: {
  readonly editable: boolean;
  readonly disabled: boolean;
  readonly animVal: string;
  readonly onChangeAnim: (tw: string, css: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <MotionSelectField
      testId="motion-animation"
      label={t('inspector.fields.animation')}
      disabled={disabled}
      value={animVal}
      options={ANIMATION_VALUES.map((v) => ({
        value: editable ? v : (CSS_ANIMATION_MAP[v] ?? v),
        label: v,
      }))}
      onChange={(v) => {
        const tw = Object.entries(CSS_ANIMATION_MAP).find(([, c]) => c === v)?.[0] ?? v;
        onChangeAnim(tw, CSS_ANIMATION_MAP[tw] ?? v);
      }}
    />
  );
}

/**
 * Plays on the Canvas what the element has: its reveal, animation and hover look (the owner,
 * 2026-11-18: preview shows what was set, it is not a place to choose). Nothing set, nothing to
 * play: the button says so.
 */
function MotionPreviewButton({
  refTarget,
  hasMotion,
}: {
  readonly refTarget: ElementRef;
  readonly hasMotion: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid="motion-preview"
      disabled={!hasMotion}
      title={hasMotion ? undefined : t('inspector.motion.previewNothing')}
      onClick={() => {
        studioBridgeChannel.sendMotionPreview(refTarget);
      }}
      className="flex h-7 w-full items-center justify-center gap-1 rounded border border-line bg-card-solid px-2.5 text-xs font-medium text-ink hover:bg-field disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Play className="size-3" />
      <span>{t('inspector.motion.preview')}</span>
    </button>
  );
}

/** One choice for the whole effect: a preset, "None" to take it off, "Custom" when edited by hand. */
function MotionPresetSelect({
  disabled,
  shown,
  onPick,
}: {
  readonly disabled: boolean;
  readonly shown: MotionPresetId | 'none' | 'custom';
  readonly onPick: (presetId: MotionPresetId | 'none') => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-ink-faint">{t('inspector.motion.effect')}</span>
      <select
        data-testid="motion-preset-select"
        disabled={disabled}
        value={shown}
        onChange={(e) => {
          const id = MOTION_PRESETS.find((p) => p.id === e.target.value)?.id;
          onPick(id ?? 'none');
        }}
        className="h-7 rounded border border-line bg-card-solid px-1.5 text-xs text-ink"
      >
        <option value="none">{t('inspector.motion.effectNone')}</option>
        {MOTION_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {t(preset.labelKey)}
          </option>
        ))}
        {shown === 'custom' && (
          <option value="custom" disabled>
            {t('inspector.motion.effectCustom')}
          </option>
        )}
      </select>
    </label>
  );
}

function useMotionSectionHandlers(props: InspectorMotionSectionProps) {
  const scope = props.currentScope ?? { breakpoint: 'base' };
  const tokens = props.tokens ?? [];
  const readVal = (prop: PropertyId) =>
    props.editable ? readTwTokenStr(tokens, scope, prop) : readCssPropVal(props.cssReading, prop);

  const commitProp = (prop: PropertyId, twVal: string, cssVal: string) => {
    if (props.editable && props.onPropChange !== undefined) {
      const value: ClassValue | undefined =
        twVal === ''
          ? undefined
          : prop === 'duration' || prop === 'delay'
            ? { kind: 'scale', token: twVal }
            : { kind: 'keyword', name: twVal };
      props.onPropChange(prop, value);
      return;
    }
    void props.onCssCommit?.(prop, cssVal);
  };

  // A new preset first takes the old one off, hover parts included: nothing piles up (TK-16).
  const applyPreset = async (presetId: MotionPresetId | 'none') => {
    if (props.editable && props.onBatchProps !== undefined) {
      props.onBatchProps(twPresetEntries(presetId, scope));
      return;
    }
    const preset = MOTION_PRESETS.find((p) => p.id === presetId);
    for (const step of [...cssClearSteps(), ...(preset?.cssSteps ?? [])]) {
      await props.onCssCommit?.(step.property, step.value, step.state);
    }
  };

  return { readVal, commitProp, applyPreset };
}

export function InspectorMotionSection(props: InspectorMotionSectionProps) {
  const { t } = useTranslation();
  const { readVal, commitProp, applyPreset } = useMotionSectionHandlers(props);
  const animVal = readVal('animation');
  const revealed = useRevealWrapped(props.refTarget, props.source);

  return (
    <InspectorGroup
      id="motion"
      title={t('inspector.groups.motion')}
      defaultOpen={animVal !== '' || readVal('transitionProperty') !== ''}
      testId="inspector-motion"
    >
      <div className="space-y-2.5">
        <MotionPresetSelect
          disabled={props.disabled}
          shown={presetShown(readVal, props.editable)}
          onPick={(id) => {
            void applyPreset(id);
          }}
        />
        <TransitionGrid
          editable={props.editable}
          disabled={props.disabled}
          readVal={readVal}
          commitProp={commitProp}
          source={props}
        />
        <AnimationField
          editable={props.editable}
          disabled={props.disabled}
          animVal={animVal}
          onChangeAnim={(tw, css) => {
            commitProp('animation', tw, css);
          }}
        />
        <RevealControls
          refTarget={props.refTarget}
          source={props.source}
          disabled={props.disabled}
          onRefresh={props.onRefresh}
        />
        <MotionPreviewButton
          refTarget={props.refTarget}
          hasMotion={animVal !== '' || readVal('transitionProperty') !== '' || revealed}
        />
      </div>
    </InspectorGroup>
  );
}
