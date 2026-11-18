// Motion quick presets and Tailwind/CSS mappings (K9.7-2 TK-16, TK-17, TK-22).
import type { Scope, StyleState } from '@kumicraft/shared';

import type { BatchPropEntry } from '../use-live-edit.ts';

export const TRANSITION_PROPS = [
  'none',
  'all',
  'colors',
  'opacity',
  'shadow',
  'transform',
] as const;
export const DURATION_VALUES = ['75', '150', '200', '300', '500', '700'] as const;
export const EASE_VALUES = ['linear', 'in', 'out', 'in-out'] as const;
export const DELAY_VALUES = ['0', '100', '200', '300', '500'] as const;
export const ANIMATION_VALUES = [
  'none',
  'fade-in',
  'slide-up',
  'zoom-in',
  'pulse',
  'bounce',
  'spin',
] as const;

export const CSS_TRANSITION_MAP: Readonly<Record<string, string>> = {
  none: 'none',
  all: 'all',
  colors: 'color, background-color, border-color',
  opacity: 'opacity',
  shadow: 'box-shadow',
  transform: 'transform',
};

export const CSS_EASE_MAP: Readonly<Record<string, string>> = {
  linear: 'linear',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
};

export const CSS_ANIMATION_MAP: Readonly<Record<string, string>> = {
  none: 'none',
  'fade-in': 'kc-fade-in 0.4s ease-out both',
  'slide-up': 'kc-slide-up 0.4s ease-out both',
  'zoom-in': 'kc-zoom-in 0.35s ease-out both',
  pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  bounce: 'bounce 1s infinite',
  spin: 'spin 1s linear infinite',
};

export type MotionPresetLabelKey =
  | 'inspector.motion.presets.hoverLift'
  | 'inspector.motion.presets.hoverScale'
  | 'inspector.motion.presets.glowBorder'
  | 'inspector.motion.presets.fadeIn'
  | 'inspector.motion.presets.slideUp';

export type MotionPreset = {
  readonly id: 'hover-lift' | 'hover-scale' | 'glow-border' | 'fade-in' | 'slide-up';
  readonly labelKey: MotionPresetLabelKey;
  readonly previewClass: string;
  readonly twEntries: (scope: Scope) => readonly BatchPropEntry[];
  readonly cssSteps: readonly {
    readonly property: string;
    readonly value: string;
    readonly state?: StyleState;
  }[];
};

function makeHover(scope: Scope): Scope {
  return { ...scope, state: scope.state ?? ('hover' as const) };
}

export const MOTION_PRESETS: readonly MotionPreset[] = [
  {
    id: 'hover-lift',
    labelKey: 'inspector.motion.presets.hoverLift',
    previewClass: 'transition-all duration-200 -translate-y-0.5 shadow-lg',
    twEntries: (scope) => [
      { property: 'transitionProperty', value: { kind: 'keyword', name: 'all' } },
      { property: 'duration', value: { kind: 'scale', token: '200' } },
      { property: 'translateY', value: { kind: 'scale', token: '-1' }, scope: makeHover(scope) },
      { property: 'boxShadow', value: { kind: 'scale', token: 'lg' }, scope: makeHover(scope) },
    ],
    cssSteps: [
      { property: 'transitionProperty', value: 'all' },
      { property: 'duration', value: '200ms' },
      { property: 'translateY', value: '-4px', state: 'hover' },
      { property: 'boxShadow', value: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', state: 'hover' },
    ],
  },
  {
    id: 'hover-scale',
    labelKey: 'inspector.motion.presets.hoverScale',
    previewClass: 'transition-transform duration-200 scale-105',
    twEntries: (scope) => [
      { property: 'transitionProperty', value: { kind: 'keyword', name: 'transform' } },
      { property: 'duration', value: { kind: 'scale', token: '200' } },
      { property: 'scale', value: { kind: 'scale', token: '105' }, scope: makeHover(scope) },
    ],
    cssSteps: [
      { property: 'transitionProperty', value: 'transform' },
      { property: 'duration', value: '200ms' },
      { property: 'scale', value: '1.05', state: 'hover' },
    ],
  },
  {
    id: 'glow-border',
    labelKey: 'inspector.motion.presets.glowBorder',
    previewClass: 'transition-shadow duration-200 shadow-lg',
    twEntries: (scope) => [
      { property: 'transitionProperty', value: { kind: 'keyword', name: 'shadow' } },
      { property: 'duration', value: { kind: 'scale', token: '200' } },
      { property: 'boxShadow', value: { kind: 'scale', token: 'lg' }, scope: makeHover(scope) },
      {
        property: 'shadowColor',
        value: { kind: 'scale', token: 'blue-500' },
        scope: makeHover(scope),
      },
    ],
    cssSteps: [
      { property: 'transitionProperty', value: 'box-shadow' },
      { property: 'duration', value: '200ms' },
      { property: 'boxShadow', value: '0 0 20px rgba(59, 130, 246, 0.45)', state: 'hover' },
    ],
  },
  {
    id: 'fade-in',
    labelKey: 'inspector.motion.presets.fadeIn',
    previewClass: 'animate-fade-in',
    twEntries: () => [{ property: 'animation', value: { kind: 'keyword', name: 'fade-in' } }],
    cssSteps: [{ property: 'animation', value: CSS_ANIMATION_MAP['fade-in'] ?? 'none' }],
  },
  {
    id: 'slide-up',
    labelKey: 'inspector.motion.presets.slideUp',
    previewClass: 'animate-slide-up',
    twEntries: () => [{ property: 'animation', value: { kind: 'keyword', name: 'slide-up' } }],
    cssSteps: [{ property: 'animation', value: CSS_ANIMATION_MAP['slide-up'] ?? 'none' }],
  },
];

export type MotionPresetId = MotionPreset['id'];

const keyOf = (property: string, state: StyleState | undefined) => `${property}@${state ?? 'base'}`;

/** Every class a preset can write, removed: "None" takes a preset off in one step (TK-16). */
export function twClearEntries(scope: Scope): BatchPropEntry[] {
  const seen = new Map<string, BatchPropEntry>();
  const extra: readonly BatchPropEntry[] = [
    { property: 'ease', value: undefined, scope },
    { property: 'delay', value: undefined, scope },
  ];
  for (const entry of [...MOTION_PRESETS.flatMap((p) => p.twEntries(scope)), ...extra]) {
    const at = entry.scope ?? scope;
    seen.set(keyOf(entry.property, at.state), {
      property: entry.property,
      value: undefined,
      scope: at,
    });
  }
  return [...seen.values()];
}

/** One batch that takes off whatever preset is there and puts `id` on ("none": only off). */
export function twPresetEntries(id: MotionPresetId | 'none', scope: Scope): BatchPropEntry[] {
  const out = new Map<string, BatchPropEntry>();
  for (const e of twClearEntries(scope)) out.set(keyOf(e.property, e.scope?.state), e);
  const preset = MOTION_PRESETS.find((p) => p.id === id);
  for (const e of preset?.twEntries(scope) ?? []) {
    out.set(keyOf(e.property, (e.scope ?? scope).state), { ...e, scope: e.scope ?? scope });
  }
  return [...out.values()];
}

/** The CSS steps that take every preset declaration off (an empty value removes it). */
export function cssClearSteps(): MotionPreset['cssSteps'] {
  const seen = new Map<string, MotionPreset['cssSteps'][number]>();
  for (const step of MOTION_PRESETS.flatMap((p) => p.cssSteps)) {
    seen.set(keyOf(step.property, step.state), { ...step, value: '' });
  }
  return [...seen.values()];
}

type MotionProp = 'transitionProperty' | 'duration' | 'animation';
const SHOWN_PROPS: readonly MotionProp[] = ['transitionProperty', 'duration', 'animation'];

/** The base value a preset writes for `prop`, as the Inspector reads it back. */
function presetValue(preset: MotionPreset, prop: MotionProp, tailwind: boolean): string {
  if (!tailwind) return preset.cssSteps.find((s) => s.property === prop && !s.state)?.value ?? '';
  const entry = preset
    .twEntries({ breakpoint: 'base' })
    .find((e) => e.property === prop && !e.scope);
  const v = entry?.value;
  if (v === undefined) return '';
  return v.kind === 'keyword' ? v.name : v.kind === 'scale' ? v.token : '';
}

/**
 * The preset the element shows, read from its base transition, duration and animation:
 * `none` when no motion is set, `custom` when the values match no preset.
 */
export function presetShown(
  readVal: (prop: MotionProp) => string,
  tailwind: boolean,
): MotionPresetId | 'none' | 'custom' {
  const now = SHOWN_PROPS.map((prop) => [prop, readVal(prop)] as const);
  if (now.every(([, v]) => v === '' || v === 'none')) return 'none';
  const match = MOTION_PRESETS.find((p) =>
    now.every(([prop, v]) => presetValue(p, prop, tailwind) === v),
  );
  return match?.id ?? 'custom';
}
