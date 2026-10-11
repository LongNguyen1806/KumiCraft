import { describe, expect, it } from 'vitest';

import { FEATURES, RELEASED_PHASE, resolveEnabledFeatures } from './features.ts';

describe('resolveEnabledFeatures', () => {
  it('enables only features of released phases without an override', () => {
    const enabled = resolveEnabledFeatures();

    expect(enabled.every((id) => FEATURES[id].phase <= RELEASED_PHASE)).toBe(true);
  });

  it('enables every feature with the "all" override', () => {
    const enabled = resolveEnabledFeatures('all');

    expect(enabled).toEqual(Object.keys(FEATURES));
  });

  it('enables the listed features and ignores unknown ids and spaces', () => {
    const enabled = resolveEnabledFeatures(' ai, export ,nope,');

    expect(enabled).toEqual(['export', 'ai']);
  });
});
