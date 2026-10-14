// Feature flags by construction phase (SPEC-07 section 2). Shared by server and Studio: a feature
// stays hidden until the gate of its phase has passed.

/** Every feature that is hidden until the gate of its phase has passed. */
export const FEATURES = {
  structureEdit: { phase: 2 },
  pages: { phase: 2 },
  ai: { phase: 3 },
  tokens: { phase: 4 },
  extractComponent: { phase: 4 },
  multiFrame: { phase: 4 },
  buildCheck: { phase: 4 },
} as const;

/** Identifier of a feature flag. */
export type FeatureId = keyof typeof FEATURES;

/** Highest phase whose acceptance gate has passed. */
export const RELEASED_PHASE: number = 0;

const FEATURE_IDS = Object.keys(FEATURES) as readonly FeatureId[];

/**
 * Lists the enabled features.
 *
 * A feature is enabled when its phase is at most {@link RELEASED_PHASE}, or when the development
 * override names it.
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
