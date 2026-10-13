// Acceptance tests of WP-1.09 part A, written before the code (SPEC-03 sections 2.2, 2.2a;
// SPEC-04.1 sections 11.1, 11.3). Do not change them to make them pass: report instead.
import { describe, expect, it } from 'vitest';

import allNodes from '../../../../fixtures/designs/all-nodes.json' with { type: 'json' };
import { applyBatch } from '../operations/batch.ts';
import type { DesignDocument } from '../schema/document.schema.ts';
import type { DesignNode } from '../schema/node.schema.ts';
import { normalizeResponsiveStyle } from './normalize-responsive.ts';
import { bandOf, editBreakpoint, effectiveStyleValue, styleScope } from './responsive-scope.ts';

const px = (n: number) => ({ px: n });
const pad = (n: number) => ({ top: px(n), right: px(n), bottom: px(n), left: px(n) });

describe('bandOf (SPEC-03 section 2.2a)', () => {
  it('desktop-first: the smallest key whose breakpoint is above the width, or base from 1536', () => {
    const widths = [1920, 1536, 1440, 1280, 1024, 800, 768, 640, 375];
    expect(widths.map((w) => bandOf(w, 'desktop-first'))).toEqual([
      'base',
      'base',
      '2xl',
      '2xl',
      'xl',
      'lg',
      'lg',
      'md',
      'sm',
    ]);
  });

  it('mobile-first: the largest key at or below the width, or base under 640', () => {
    const widths = [375, 639, 640, 768, 1023, 1024, 1440, 1536, 1920];
    expect(widths.map((w) => bandOf(w, 'mobile-first'))).toEqual([
      'base',
      'base',
      'sm',
      'md',
      'md',
      'lg',
      'xl',
      '2xl',
      '2xl',
    ]);
  });
});

describe('editBreakpoint (SPEC-03 section 2.2a, SPEC-04.1 section 11.1)', () => {
  it('desktop-first with the 1440 primary frame: the spec example table', () => {
    const frames = [1440, 1280, 768, 375];
    expect(frames.map((w) => editBreakpoint(w, 1440, 'desktop-first'))).toEqual([
      'base',
      'base',
      'lg',
      'sm',
    ]);
  });

  it('mobile-first with the 375 primary frame', () => {
    const frames = [375, 768, 1440];
    expect(frames.map((w) => editBreakpoint(w, 375, 'mobile-first'))).toEqual(['base', 'md', 'xl']);
  });
});

describe('effectiveStyleValue (R-IN-02, R-IN-03)', () => {
  const node: Pick<DesignNode, 'style' | 'responsive'> = {
    style: { padding: pad(24), gap: px(16) },
    responsive: { lg: { padding: pad(16) }, sm: { padding: pad(8) } },
  };

  it('desktop-first: a smaller key wins when several apply, and says where the value comes from', () => {
    expect(effectiveStyleValue(node, 'padding', 375, 'desktop-first')).toEqual({
      value: pad(8),
      from: 'sm',
    });
    expect(effectiveStyleValue(node, 'padding', 800, 'desktop-first')).toEqual({
      value: pad(16),
      from: 'lg',
    });
    expect(effectiveStyleValue(node, 'padding', 1440, 'desktop-first')).toEqual({
      value: pad(24),
      from: 'base',
    });
  });

  it('a property no override touches comes from base; an unset one from nowhere', () => {
    expect(effectiveStyleValue(node, 'gap', 375, 'desktop-first')).toEqual({
      value: px(16),
      from: 'base',
    });
    expect(effectiveStyleValue(node, 'radius', 375, 'desktop-first')).toEqual({
      value: undefined,
      from: undefined,
    });
  });

  it('desktop-first also applies the 2xl key below 1536', () => {
    const wide: Pick<DesignNode, 'style' | 'responsive'> = {
      style: { gap: px(32) },
      responsive: { '2xl': { gap: px(24) } },
    };
    expect(effectiveStyleValue(wide, 'gap', 1440, 'desktop-first').value).toEqual(px(24));
    expect(effectiveStyleValue(wide, 'gap', 1920, 'desktop-first').value).toEqual(px(32));
  });

  it('mobile-first: a larger key wins', () => {
    const mobile: Pick<DesignNode, 'style' | 'responsive'> = {
      style: { gap: px(8) },
      responsive: { md: { gap: px(16) }, xl: { gap: px(24) } },
    };
    const at = (w: number) => effectiveStyleValue(mobile, 'gap', w, 'mobile-first');
    expect([at(375), at(800), at(1440)]).toEqual([
      { value: px(8), from: 'base' },
      { value: px(16), from: 'md' },
      { value: px(24), from: 'xl' },
    ]);
  });
});

describe('styleScope (V-28)', () => {
  it('maps a breakpoint and a state to the scope of a setStyle operation', () => {
    expect(styleScope('base')).toEqual({});
    expect(styleScope('sm')).toEqual({ breakpoint: 'sm' });
    expect(styleScope('base', 'hover')).toEqual({ state: 'hover' });
  });

  it('refuses a state outside the base breakpoint', () => {
    expect(styleScope('sm', 'hover')).toBeUndefined();
  });
});

describe('normalizeResponsiveStyle includes 2xl in desktop-first (V-29)', () => {
  it('drops a 2xl value equal to base', () => {
    expect(
      normalizeResponsiveStyle({ gap: px(24) }, { '2xl': { gap: px(24) } }, 'desktop-first'),
    ).toBeUndefined();
  });
});

describe('AC-03 at model level', () => {
  it('an edit in the Mobile 375 frame changes Mobile only; Desktop keeps the base value', () => {
    const doc = JSON.parse(JSON.stringify(allNodes)) as DesignDocument;
    const home = doc.pages['p_home000001'];
    if (home === undefined) throw new Error('fixture has no home page');
    home.root = {
      id: 'n_root000001',
      type: 'Stack',
      content: { kind: 'none' },
      children: [
        {
          id: 'n_card000001',
          type: 'Card',
          content: { kind: 'none' },
          style: { padding: pad(24) },
        },
      ],
    };
    const scope = styleScope(editBreakpoint(375, 1440, 'desktop-first'));
    if (scope === undefined) throw new Error('no scope');

    const applied = applyBatch(doc, [
      {
        op: 'setStyle',
        target: { kind: 'page', pageId: 'p_home000001' },
        nodeId: 'n_card000001',
        scope,
        set: { padding: pad(8) },
      },
    ]);
    if (!applied.ok) throw new Error(JSON.stringify(applied.error));
    const card = applied.value.doc.pages['p_home000001']?.root.children?.[0];
    if (card === undefined) throw new Error('no card');

    expect(effectiveStyleValue(card, 'padding', 375, 'desktop-first').value).toEqual(pad(8));
    expect(effectiveStyleValue(card, 'padding', 1440, 'desktop-first').value).toEqual(pad(24));
    expect(effectiveStyleValue(card, 'padding', 768, 'desktop-first').value).toEqual(pad(24));
  });
});
