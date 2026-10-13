import { describe, expect, it } from 'vitest';

import allNodes from '../../../../fixtures/designs/all-nodes.json' with { type: 'json' };
import { canInsert } from '../operations/can-insert.ts';
import type { DesignDocument } from '../schema/document.schema.ts';
import { createDefaultTokens } from '../tokens/default-tokens.ts';
import { instantiatePreset } from './instantiate.ts';
import { PRESETS } from './presets.ts';

// The fixture keeps only some of the default tokens, like a workspace whose owner deleted a few.
const doc = allNodes as unknown as DesignDocument;
const page = doc.pages['p_home000001'];
const target = { kind: 'page', pageId: 'p_home000001' } as const;

describe('instantiatePreset (R-LB-02)', () => {
  it('fits every preset into a workspace that lacks some default tokens [R-LB-02]', () => {
    const rootId = page?.root.id ?? '';
    const rejected = PRESETS.filter((preset) => {
      const { node } = instantiatePreset(preset, { tokens: doc.tokens, contentLocale: 'vi-VN' });
      return !canInsert(doc, target, rootId, { kind: 'new', node }, 0).ok;
    }).map((preset) => preset.id);

    expect(rejected).toEqual([]);
  });

  it('replaces a missing token by the default value and reports it [R-LB-02]', () => {
    const section = PRESETS.find((preset) => preset.id === 'layout.section');
    if (section === undefined) throw new Error('no Section preset');
    const tokens = { ...doc.tokens, spacing: {} };

    const { node, replacedTokens } = instantiatePreset(section, { tokens });

    expect(JSON.stringify(node.style)).not.toContain('token:spacing.');
    expect(node.style?.padding?.top).toEqual({ px: 64 });
    expect(replacedTokens).toContain('token:spacing.16');
  });

  it('changes nothing when the workspace has every default token', () => {
    const tokens = createDefaultTokens();
    const changed = PRESETS.filter((preset) => {
      const fitted = instantiatePreset(preset, { tokens, contentLocale: 'en-US' });
      const plain = preset.create({ tokens, contentLocale: 'en-US' });
      return (
        fitted.replacedTokens.length > 0 || JSON.stringify(fitted.node) !== JSON.stringify(plain)
      );
    }).map((preset) => preset.id);

    expect(changed).toEqual([]);
  });
});
