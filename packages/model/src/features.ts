// Feature flags by construction phase (SPEC-07 section 3.4). Shared by server and Studio.

/** Every feature that is hidden until the gate of its phase has passed. */
export const FEATURES = {
  export: { phase: 2 },
  interactions: { phase: 2 },
  richText: { phase: 2 },
  darkMode: { phase: 2 },
  ai: { phase: 3 },
  backend: { phase: 4 },
  components: { phase: 5 },
  tokens: { phase: 5 },
  multiFrame: { phase: 5 },
  layoutSuggest: { phase: 5 },
} as const;

/** Identifier of a feature flag. */
export type FeatureId = keyof typeof FEATURES;

/** Highest phase whose acceptance gate has passed (CW-16). */
export const RELEASED_PHASE: number = 0;

const FEATURE_IDS = Object.keys(FEATURES) as readonly FeatureId[];

/**
 * Lists the enabled features.
 *
 * A feature is enabled when its phase is at most {@link RELEASED_PHASE}, or when the development
 * override names it (CW-17).
 *
 * @param override - Value of `REACTCRAFT_FEATURES`: `all`, or feature ids separated by commas.
 *   Unknown ids are ignored.
 * @returns Enabled feature ids in declaration order.
 */
export function resolveEnabledFeatures(override?: string): readonly FeatureId[] {
  const requested = new Set(
    (override ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== ''),
  );
  const isAll = requested.has('all');
  return FEATURE_IDS.filter(
    (id) => FEATURES[id].phase <= RELEASED_PHASE || isAll || requested.has(id),
  );
}
