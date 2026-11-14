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
import type { BatchPropEntry } from '../use-live-edit.ts';
import { readCssPropVal, readTwTokenStr } from './effects-helpers.ts';
import { InspectorGroup } from './inspector-group.tsx';
import {
  ANIMATION_VALUES,
  CSS_ANIMATION_MAP,
  CSS_EASE_MAP,
  CSS_TRANSITION_MAP,
  DELAY_VALUES,
  DURATION_VALUES,
  EASE_VALUES,
  MOTION_PRESETS,
  TRANSITION_PROPS,
} from './motion-presets.ts';
import { formatMs, MotionSelectField, RevealControls } from './motion-reveal.tsx';

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
};

function TransitionGrid({
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
  const timeOpts = (values: readonly string[]) =>
    values.map((v) => ({ value: editable ? v : formatMs(v), label: formatMs(v) }));
  const commitMs = (prop: PropertyId, v: string) => {
    commitProp(prop, v.replace('ms', ''), v === '' || v.endsWith('ms') ? v : formatMs(v));
  };
  return (
    <div className="grid grid-cols-2 gap-1.5">
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
        testId="motion-duration"
        label={t('inspector.fields.duration')}
        disabled={disabled}
        value={readVal('duration')}
        options={timeOpts(DURATION_VALUES)}
        onChange={(v) => {
          commitMs('duration', v);
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
      <MotionSelectField
        testId="motion-delay"
        label={t('inspector.fields.delay')}
        disabled={disabled}
        value={readVal('delay')}
        options={timeOpts(DELAY_VALUES)}
        onChange={(v) => {
          commitMs('delay', v);
        }}
      />
    </div>
  );
}

function AnimationPreviewRow({
  editable,
  disabled,
  animVal,
  refTarget,
  onChangeAnim,
}: {
  readonly editable: boolean;
  readonly disabled: boolean;
  readonly animVal: string;
  readonly refTarget: ElementRef;
  readonly onChangeAnim: (tw: string, css: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-end gap-1.5">
      <div className="min-w-0 flex-1">
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
      </div>
      <button
        type="button"
        data-testid="motion-preview"
        onClick={() => {
          studioBridgeChannel.sendMotionPreview(
            refTarget,
            animVal !== '' && editable ? `animate-${animVal}` : undefined,
          );
        }}
        className="flex h-7 items-center gap-1 rounded border border-line bg-card-solid px-2.5 text-xs font-medium text-ink hover:bg-field"
      >
        <Play className="size-3" />
        <span>{t('inspector.motion.preview')}</span>
      </button>
    </div>
  );
}

function MotionPresetButtons({
  disabled,
  onPick,
}: {
  readonly disabled: boolean;
  readonly onPick: (presetId: (typeof MOTION_PRESETS)[number]['id']) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-1">
      {MOTION_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          data-testid={`motion-preset-${preset.id}`}
          disabled={disabled}
          onClick={() => {
            onPick(preset.id);
          }}
          className="rounded border border-line bg-field px-1.5 py-0.5 text-[10px] font-medium text-ink hover:border-accent hover:bg-card-solid disabled:opacity-40"
        >
          {t(preset.labelKey)}
        </button>
      ))}
    </div>
  );
}

export function InspectorMotionSection(props: InspectorMotionSectionProps) {
  const { t } = useTranslation();
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

  const applyPreset = async (presetId: (typeof MOTION_PRESETS)[number]['id']) => {
    const preset = MOTION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    if (props.editable && props.onBatchProps !== undefined) {
      props.onBatchProps(preset.twEntries(scope));
      return;
    }
    for (const step of preset.cssSteps) {
      await props.onCssCommit?.(step.property, step.value, step.state);
    }
  };

  const animVal = readVal('animation');
  return (
    <InspectorGroup
      id="motion"
      title={t('inspector.groups.motion')}
      defaultOpen={animVal !== '' || readVal('transitionProperty') !== ''}
      testId="inspector-motion"
    >
      <div className="space-y-2.5">
        <MotionPresetButtons
          disabled={props.disabled}
          onPick={(id) => {
            void applyPreset(id);
          }}
        />
        <TransitionGrid
          editable={props.editable}
          disabled={props.disabled}
          readVal={readVal}
          commitProp={commitProp}
        />
        <AnimationPreviewRow
          editable={props.editable}
          disabled={props.disabled}
          animVal={animVal}
          refTarget={props.refTarget}
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
      </div>
    </InspectorGroup>
  );
}
