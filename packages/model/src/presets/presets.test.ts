import { describe, expect, it } from 'vitest';

import allNodes from '../../../../fixtures/designs/all-nodes.json' with { type: 'json' };
import { applyBatch, assignIds } from '../operations/batch.ts';
import type { TreeTarget } from '../operations/operation.schema.ts';
import type { DesignDocument } from '../schema/document.schema.ts';
import { checkDocument } from '../schema/validate/validate-document.ts';
import { createDefaultTokens } from '../tokens/default-tokens.ts';
import { PRESETS } from './presets.ts';

const baseDoc = allNodes as unknown as DesignDocument;

function createEmptyDocument(): DesignDocument {
  const doc = JSON.parse(JSON.stringify(baseDoc)) as DesignDocument;
  doc.tokens = createDefaultTokens();
  const home = doc.pages['p_home000001'];
  if (home) {
    home.root = {
      id: 'n_root000001',
      type: 'Stack',
      content: { kind: 'none' },
      style: { direction: 'column' },
      children: [],
    };
  }
  return doc;
}

describe('Component Library Presets (SPEC-04.1 section 10.2)', () => {
  it('contains all required non-interactive presets from Table 10.2', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(30);
    const ids = PRESETS.map((p) => p.id);
    expect(ids).toContain('layout.stack-row');
    expect(ids).toContain('layout.stack-column');
    expect(ids).toContain('layout.grid-3-col');
    expect(ids).toContain('layout.grid-auto-fit');
    expect(ids).toContain('layout.section');
    expect(ids).toContain('layout.container');
    expect(ids).toContain('content.heading');
    expect(ids).toContain('content.text');
    expect(ids).toContain('content.image');
    expect(ids).toContain('content.icon');
    expect(ids).toContain('content.link');
    expect(ids).toContain('content.divider');
    expect(ids).toContain('content.badge');
    expect(ids).toContain('content.avatar');
    expect(ids).toContain('form.form');
    expect(ids).toContain('form.input');
    expect(ids).toContain('form.textarea');
    expect(ids).toContain('form.select');
    expect(ids).toContain('form.checkbox');
    expect(ids).toContain('form.radio');
    expect(ids).toContain('form.switch');
    expect(ids).toContain('form.button');
    expect(ids).toContain('data.table');
    expect(ids).toContain('data.list');
    expect(ids).toContain('data.detail-view');
    expect(ids).toContain('composite.card');
    expect(ids).toContain('composite.navbar');
    expect(ids).toContain('composite.sidebar');
    expect(ids).toContain('composite.footer');
    expect(ids).toContain('composite.modal');
    expect(ids).toContain('composite.tabs');
    expect(ids).toContain('composite.hero');
  });

  it('every preset creates a valid tree that passes checkDocument after assignIds', () => {
    const target: TreeTarget = { kind: 'page', pageId: 'p_home000001' };

    for (const preset of PRESETS) {
      const emptyDoc = createEmptyDocument();
      const node = preset.create({ contentLocale: 'vi-VN' });
      const rawOp = {
        op: 'insert' as const,
        target,
        parentId: 'n_root000001',
        index: 0,
        node,
      };
      const { ops } = assignIds([rawOp]);
      const applied = applyBatch(emptyDoc, ops);
      expect(applied.ok, `Failed to apply preset ${preset.id}: ${JSON.stringify(applied)}`).toBe(
        true,
      );
      if (applied.ok) {
        const checked = checkDocument(applied.value.doc);
        expect(
          checked.ok,
          `checkDocument failed for ${preset.id}: ${JSON.stringify(checked)}`,
        ).toBe(true);
      }
    }
  });

  it('respects contentLocale for sample texts [R-LB-01]', () => {
    const headingPreset = PRESETS.find((p) => p.id === 'content.heading');
    expect(headingPreset).toBeDefined();
    const headingVi = headingPreset?.create({ contentLocale: 'vi-VN' });
    const headingEn = headingPreset?.create({ contentLocale: 'en-US' });
    expect(headingVi?.content && 'text' in headingVi.content ? headingVi.content.text : '').toBe(
      'Tiêu đề',
    );
    expect(headingEn?.content && 'text' in headingEn.content ? headingEn.content.text : '').toBe(
      'Heading',
    );

    const buttonPreset = PRESETS.find((p) => p.id === 'form.button');
    expect(buttonPreset).toBeDefined();
    const buttonVi = buttonPreset?.create({ contentLocale: 'vi-VN' });
    const buttonEn = buttonPreset?.create({ contentLocale: 'en-US' });
    expect(buttonVi?.content && 'text' in buttonVi.content ? buttonVi.content.text : '').toBe(
      'Nút',
    );
    expect(buttonEn?.content && 'text' in buttonEn.content ? buttonEn.content.text : '').toBe(
      'Button',
    );

    const heroPreset = PRESETS.find((p) => p.id === 'composite.hero');
    const heroVi = heroPreset?.create({ contentLocale: 'vi-VN' });
    const heroEn = heroPreset?.create({ contentLocale: 'en-US' });
    const h1Vi = heroVi?.children?.[0];
    const h1En = heroEn?.children?.[0];
    const textVi =
      h1Vi &&
      typeof h1Vi === 'object' &&
      'content' in h1Vi &&
      h1Vi.content &&
      'text' in h1Vi.content
        ? h1Vi.content.text
        : '';
    const textEn =
      h1En &&
      typeof h1En === 'object' &&
      'content' in h1En &&
      h1En.content &&
      'text' in h1En.content
        ? h1En.content.text
        : '';
    expect(textVi).toBe('Xây dựng tương lai hôm nay');
    expect(textEn).toBe('Build the future today');
  });

  it('uses only tokens from the default tokens set [R-LB-02]', () => {
    const defaultTokens = createDefaultTokens();

    function checkTokensInObject(obj: unknown) {
      if (typeof obj === 'string' && obj.startsWith('token:')) {
        const withoutPrefix = obj.slice('token:'.length);
        const [group, name] = withoutPrefix.split('.');
        const groupObj = defaultTokens[group as keyof typeof defaultTokens] as
          Record<string, unknown> | undefined;
        expect(groupObj, `Group ${group ?? ''} must exist in default tokens`).toBeDefined();
        expect(groupObj?.[name ?? ''], `Token ${obj} must exist in default tokens`).toBeDefined();
      } else if (Array.isArray(obj)) {
        for (const item of obj) checkTokensInObject(item);
      } else if (typeof obj === 'object' && Boolean(obj)) {
        for (const val of Object.values(obj as Record<string, unknown>)) checkTokensInObject(val);
      }
    }

    for (const preset of PRESETS) {
      const node = preset.create();
      checkTokensInObject(node);
    }
  });

  it('matches golden default values of Table 10.2', () => {
    const stackRow = PRESETS.find((p) => p.id === 'layout.stack-row')?.create();
    expect(stackRow?.style?.direction).toBe('row');
    expect(stackRow?.style?.gap).toBe('token:spacing.4');
    expect(stackRow?.style?.align).toBe('center');

    const grid3Col = PRESETS.find((p) => p.id === 'layout.grid-3-col')?.create();
    expect(grid3Col?.style?.columns).toBe(3);
    expect(grid3Col?.style?.gap).toBe('token:spacing.6');

    const gridAuto = PRESETS.find((p) => p.id === 'layout.grid-auto-fit')?.create();
    expect(gridAuto?.style?.autoFit?.minColumnWidth).toEqual({ px: 240 });
    expect(gridAuto?.style?.gap).toBe('token:spacing.6');

    const section = PRESETS.find((p) => p.id === 'layout.section')?.create();
    expect(section?.style?.padding?.top).toBe('token:spacing.16');
    expect(section?.style?.padding?.bottom).toBe('token:spacing.16');
    expect(section?.style?.padding?.left).toBe('token:spacing.6');
    expect(section?.style?.padding?.right).toBe('token:spacing.6');
    expect(section?.style?.width).toBe('fill');

    const container = PRESETS.find((p) => p.id === 'layout.container')?.create();
    expect(
      container?.content && 'maxWidth' in container.content ? container.content.maxWidth : '',
    ).toBe('xl');

    const avatar = PRESETS.find((p) => p.id === 'content.avatar')?.create();
    expect(avatar?.style?.width).toEqual({ fixed: { px: 40 } });
    expect(avatar?.style?.height).toEqual({ fixed: { px: 40 } });
    expect(avatar?.style?.radius).toBe('token:radius.full');
    expect(avatar?.style?.aspectRatio).toBe('1/1');

    const badge = PRESETS.find((p) => p.id === 'content.badge')?.create();
    expect(badge?.style?.fontSize).toBe('token:fontSize.xs');
    expect(badge?.style?.radius).toBe('token:radius.full');
    expect(badge?.style?.background).toBe('token:color.secondary');
  });
});
