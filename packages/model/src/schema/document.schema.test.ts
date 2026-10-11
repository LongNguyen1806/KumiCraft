import { describe, expect, it } from 'vitest';

import {
  DesignDocumentSchema,
  DesignTokensSchema,
  PageSchema,
  UserComponentSchema,
  WorkspaceMetaSchema,
} from './document.schema.ts';
import type { Interaction } from './interaction.schema.ts';
import type { DesignNode } from './node.schema.ts';
import { node, rulesOf } from './test-support.ts';

const page = (root: DesignNode, route = '/') => ({
  schemaVersion: 1,
  id: 'p_0000000001',
  name: 'Home',
  route,
  root,
});
const component = (root: DesignNode, props: unknown[] = []) => ({
  schemaVersion: 1,
  id: 'c_0000000001',
  name: 'ProductCard',
  props,
  root,
});
const frames = [
  { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
  { id: 'mobile', label: 'Mobile', width: 375, height: 812 },
];
const workspace = {
  schemaVersion: 1,
  id: 'ws00000001',
  name: 'Shop',
  createdAt: '2026-10-11T00:00:00.000Z',
  updatedAt: '2026-10-11T00:00:00.000Z',
  revision: 0,
  pageOrder: ['p_0000000001'],
  backends: [],
  responsiveMode: 'desktop-first',
  frames,
  primaryFrameId: 'desktop',
  contentLocale: 'vi-VN',
  darkMode: 'none',
};
const tokens = {
  schemaVersion: 1,
  color: { primary: { value: '#2563eb', dark: '#60a5fa' } },
  spacing: { '4': { value: { px: 16 } } },
  radius: {},
  shadow: {},
  fontSize: {},
  fontWeight: {},
  lineHeight: {},
  fontFamily: { sans: { value: ['Inter', 'sans-serif'] } },
};

describe('PageSchema', () => {
  it('accepts a page with a column Stack root', () => {
    expect(PageSchema.safeParse(page(node('Stack', { children: [node('Text')] }))).success).toBe(
      true,
    );
  });

  it('accepts lowercase routes with :param segments [V-06]', () => {
    for (const route of ['/', '/about', '/products/:id', '/a-b/c1']) {
      expect(rulesOf(PageSchema.safeParse(page(node('Stack'), route)))).toEqual([]);
    }
    for (const route of ['', 'about', '/About', '/a//b', '/a/', '/a_b']) {
      expect(PageSchema.safeParse(page(node('Stack'), route)).success).toBe(false);
    }
  });

  it('needs a column Stack as root [V-20]', () => {
    expect(rulesOf(PageSchema.safeParse(page(node('Grid'))))).toContain('V-20');
    expect(
      rulesOf(PageSchema.safeParse(page(node('Stack', { style: { direction: 'row' } })))),
    ).toContain('V-20');
  });

  it('keeps slots and propRef out of pages [V-16, V-57]', () => {
    const withSlot = page(node('Stack', { children: [node('Slot')] }));
    const withPropRef = page(
      node('Stack', { children: [node('Text', { propRef: { prop: 'title', target: 'text' } })] }),
    );

    expect(rulesOf(PageSchema.safeParse(withSlot))).toContain('V-16');
    expect(rulesOf(PageSchema.safeParse(withPropRef))).toContain('V-57');
  });

  it('limits depth to 32 and nodes to 2000 [V-19]', () => {
    let deep = node('Stack');
    for (let i = 0; i < 32; i++) deep = node('Stack', { children: [deep] });
    const wide = node('Stack', { children: Array.from({ length: 2000 }, () => node('Text')) });

    expect(rulesOf(PageSchema.safeParse(page(deep)))).toContain('V-19');
    expect(rulesOf(PageSchema.safeParse(page(wide)))).toContain('V-19');
  });
});

describe('UserComponentSchema', () => {
  const prop = { name: 'title', kind: 'text', defaultValue: 'Product' };

  it('accepts slots and prop references inside a component', () => {
    const root = node('Card', {
      children: [node('Heading', { propRef: { prop: 'title', target: 'text' } }), node('Slot')],
    });

    expect(rulesOf(UserComponentSchema.safeParse(component(root, [prop])))).toEqual([]);
  });

  it('needs unique slot names [V-16]', () => {
    const root = node('Card', { children: [node('Slot'), node('Slot')] });

    expect(rulesOf(UserComponentSchema.safeParse(component(root)))).toContain('V-16');
  });

  it('needs propRef to name an existing prop and props to be unique [V-56, V-57]', () => {
    const root = node('Card', {
      children: [node('Heading', { propRef: { prop: 'missing', target: 'text' } })],
    });

    expect(rulesOf(UserComponentSchema.safeParse(component(root, [prop])))).toContain('V-57');
    expect(rulesOf(UserComponentSchema.safeParse(component(node('Card'), [prop, prop])))).toContain(
      'V-56',
    );
  });

  it('keeps interactions out of component definitions [V-91]', () => {
    const click: Interaction = {
      id: 'i_aaaaaaaa',
      trigger: 'click',
      actions: [{ type: 'showToast', message: 'x', tone: 'info' }],
    };
    const root = node('Card', { children: [node('Button', { interactions: [click] })] });

    expect(rulesOf(UserComponentSchema.safeParse(component(root)))).toContain('V-91');
  });

  it('needs a PascalCase name', () => {
    expect(
      UserComponentSchema.safeParse({ ...component(node('Card')), name: 'productCard' }).success,
    ).toBe(false);
  });
});

describe('WorkspaceMetaSchema', () => {
  const rules = (patch: object) =>
    rulesOf(WorkspaceMetaSchema.safeParse({ ...workspace, ...patch }));

  it('accepts the default desktop-first workspace', () => {
    expect(rules({})).toEqual([]);
  });

  it('needs unique frame ids and one existing primary frame [V-09]', () => {
    expect(rules({ primaryFrameId: 'tablet' })).toContain('V-09');
    expect(rules({ frames: [frames[0], frames[0]] })).toContain('V-09');
    expect(WorkspaceMetaSchema.safeParse({ ...workspace, frames: [] }).success).toBe(false);
  });

  it('keeps other frames on the right side of the primary frame [V-07]', () => {
    const wide = { id: 'wide', label: 'Wide', width: 1920, height: 1080 };

    expect(rules({ frames: [...frames, wide] })).toContain('V-07');
    expect(rules({ responsiveMode: 'mobile-first' })).toContain('V-07');
    expect(rules({ responsiveMode: 'mobile-first', primaryFrameId: 'mobile' })).toEqual([]);
  });
});

describe('DesignTokensSchema', () => {
  it('accepts kebab-case token names only', () => {
    expect(DesignTokensSchema.safeParse(tokens).success).toBe(true);
    expect(
      DesignTokensSchema.safeParse({ ...tokens, color: { Primary: { value: '#000000' } } }).success,
    ).toBe(false);
  });
});

describe('DesignDocumentSchema', () => {
  it('accepts a whole minimal document', () => {
    const document = {
      workspace,
      tokens,
      pages: { p_0000000001: page(node('Stack', { children: [node('Heading')] })) },
      components: {},
      dataSources: { schemaVersion: 1, auth: { kind: 'none' }, entities: [], endpoints: [] },
    };

    expect(DesignDocumentSchema.safeParse(document).success).toBe(true);
  });
});
