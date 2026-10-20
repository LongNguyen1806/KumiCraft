// Feature flags by construction phase (SPEC-07 section 2). Shared by server and Studio: a feature
// stays hidden until the gate of its phase has passed.
import { z } from 'zod';

export const FEATURE_IDS = [
  'structureEdit',
  'pages',
  'ai',
  'tokens',
  'extractComponent',
  'multiFrame',
  'buildCheck',
] as const;

/** Identifier of a feature flag. */
export type FeatureId = (typeof FEATURE_IDS)[number];

export const FeatureIdSchema = z.enum(FEATURE_IDS);

/** Every feature that is hidden until the gate of its phase has passed. */
export const FEATURES = {
  structureEdit: { phase: 2 },
  pages: { phase: 2 },
  ai: { phase: 3 },
  tokens: { phase: 4 },
  extractComponent: { phase: 4 },
  multiFrame: { phase: 4 },
  buildCheck: { phase: 4 },
} as const satisfies Readonly<Record<FeatureId, { readonly phase: number }>>;

/** Highest phase whose acceptance gate has passed. */
export const RELEASED_PHASE: number = 0;

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
