import { describe, expect, it } from 'vitest';

import type { DesignDocument, Page, UserComponent } from '../document.schema.ts';
import type { Interaction } from '../interaction.schema.ts';
import type { DesignNode } from '../node.schema.ts';
import { node } from '../test-support.ts';
import { checkDocument, validateDocument, type ValidateOptions } from './validate-document.ts';

const provenance = { origin: 'manual', confidence: 'high' } as const;
const field = (name: string, type: string, extra: object = {}) => ({
  name,
  type,
  required: false,
  readOnly: false,
  provenance,
  ...extra,
});
const endpoint = (id: string, purpose: string, method = 'GET') => ({
  id,
  method,
  path: '/api/products',
  purpose,
  entity: 'ds_products',
  params: [],
  provenance,
});

const EP = {
  list: 'ep_list000001',
  detail: 'ep_detl000001',
  create: 'ep_crea000001',
  update: 'ep_updt000001',
  remove: 'ep_dele000001',
};
const HOME = 'p_home000001';
const PRODUCT = 'p_prod000001';
const CARD = 'c_card000001';

const click = (actions: Interaction['actions']): Interaction => ({
  id: 'i_aaaaaaaa',
  trigger: 'click',
  actions,
});
const page = (id: string, route: string, children: DesignNode[]): Page => ({
  schemaVersion: 1,
  id,
  name: id,
  route,
  root: node('Stack', { children }),
});

/** A valid document: a product list with a form, a modal and a card component. */
function baseDocument(): DesignDocument {
  const modal = node('Modal', { children: [node('Text')] });
  const card = node('Card', {
    style: { padding: { top: 'token:spacing.4' }, background: 'token:color.surface' },
    children: [
      node('Heading', { bindings: { text: { source: 'ds_products', field: 'name' } } }),
      node('Image', { bindings: { src: { source: 'ds_products', field: 'image' } } }),
      node('Button', {
        interactions: [
          click([
            { type: 'navigate', pageId: PRODUCT, params: { id: { kind: 'field', field: 'id' } } },
          ]),
        ],
      }),
    ],
  });
  const list = node('List', {
    bindings: { items: { source: 'ds_products', endpoint: EP.list } },
    children: [card],
  });
  const form = node('Form', {
    bindings: { submit: { source: 'ds_products', endpoint: EP.create } },
    children: [
      node('Input', {
        content: { kind: 'input', label: 'Name', inputType: 'text', fieldName: 'name' },
        bindings: { value: { source: 'ds_products', field: 'name' } },
      }),
    ],
  });
  const opener = node('Button', {
    interactions: [click([{ type: 'openModal', modalId: modal.id }])],
  });
  const component: UserComponent = {
    schemaVersion: 1,
    id: CARD,
    name: 'ProductCard',
    props: [{ name: 'title', kind: 'text', defaultValue: 'Product' }],
    root: node('Card', {
      children: [node('Heading', { propRef: { prop: 'title', target: 'text' } }), node('Slot')],
    }),
  };
  return {
    workspace: {
      schemaVersion: 1,
      id: 'ws00000001',
      name: 'Shop',
      createdAt: '2026-10-11T00:00:00.000Z',
      updatedAt: '2026-10-11T00:00:00.000Z',
      revision: 0,
      pageOrder: [HOME, PRODUCT],
      backends: [],
      responsiveMode: 'desktop-first',
      frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
      primaryFrameId: 'desktop',
      contentLocale: 'vi-VN',
      darkMode: 'none',
    },
    tokens: {
      schemaVersion: 1,
      color: { surface: { value: '#ffffff' } },
      spacing: { '4': { value: { px: 16 } } },
      radius: {},
      shadow: {},
      fontSize: {},
      fontWeight: {},
      lineHeight: {},
      fontFamily: {},
    },
    pages: {
      [HOME]: page(HOME, '/', [
        node('Section', { children: [node('Heading')] }),
        list,
        form,
        opener,
        modal,
      ]),
      [PRODUCT]: page(PRODUCT, '/products/:id', [
        node('ComponentInstance', {
          content: { kind: 'instance', componentId: CARD, propValues: { title: 'A' } },
          slots: { actions: [node('Button')] },
        }),
      ]),
    },
    components: { [CARD]: component },
    dataSources: {
      schemaVersion: 1,
      auth: { kind: 'none' },
      entities: [
        {
          id: 'ds_products',
          name: 'Product',
          fields: [
            field('id', 'id'),
            field('name', 'string'),
            field('image', 'image'),
            field('category', 'relation', { relation: { entity: 'ds_categories', many: false } }),
          ],
          provenance,
        },
        {
          id: 'ds_categories',
          name: 'Category',
          fields: [field('id', 'id'), field('name', 'string')],
          provenance,
        },
      ],
      endpoints: [
        endpoint(EP.list, 'list'),
        endpoint(EP.detail, 'detail'),
        endpoint(EP.create, 'create', 'POST'),
        endpoint(EP.update, 'update', 'PUT'),
        endpoint(EP.remove, 'delete', 'DELETE'),
      ],
    },
  } as DesignDocument;
}

const rules = (document: DesignDocument, options?: ValidateOptions) => [
  ...new Set(validateDocument(document, options).map((detail) => detail.rule ?? 'none')),
];

/** Adds `children` to the root of the home page. */
const withHome = (...children: DesignNode[]) => {
  const document = baseDocument();
  const home = document.pages[HOME] as Page;
  home.root.children = [...(home.root.children ?? []), ...children];
  return document;
};

describe('validateDocument', () => {
  it('accepts the base document', () => {
    expect(
      validateDocument(baseDocument(), { iconNames: new Set(), assetNames: new Set(['a.png']) }),
    ).toEqual([]);
  });

  it('needs every referenced token to exist [V-01]', () => {
    expect(rules(withHome(node('Card', { style: { gap: 'token:spacing.99' } })))).toEqual(['V-01']);
    const runs = node('Text', {
      content: { kind: 'text', text: 'x', runs: [{ text: 'x', color: 'token:color.missing' }] },
    });
    expect(rules(withHome(runs))).toEqual(['V-01']);
  });

  it('needs unique routes, counting :params as equal [V-06]', () => {
    const document = baseDocument();
    const clash = page('p_othe000001', '/products/:slug', [node('Text')]);
    document.pages[clash.id] = clash;
    document.workspace.pageOrder.push(clash.id);

    expect(rules(document)).toEqual(['V-06']);
  });

  it('checks ids against keys and the page order', () => {
    const document = baseDocument();
    document.workspace.pageOrder = [HOME];

    expect(validateDocument(document).map((detail) => detail.path)).toEqual([
      'workspace.pageOrder',
    ]);
  });

  it('needs workspace assets and bundled icons when the lists are given [V-24, V-25]', () => {
    const image = node('Image', { content: { kind: 'image', src: 'asset:missing.png', alt: '' } });
    const icon = node('Icon', { content: { kind: 'icon', name: 'not-an-icon', size: { px: 16 } } });
    const document = withHome(image, icon);

    expect(rules(document)).toEqual([]);
    expect(
      rules(document, { assetNames: new Set(['a.png']), iconNames: new Set(['plus']) }),
    ).toEqual(['V-24', 'V-25']);
  });

  it('places Section, Modal and Form by their parents [V-11, V-12, V-13]', () => {
    expect(rules(withHome(node('Card', { children: [node('Section')] })))).toEqual(['V-11']);
    expect(rules(withHome(node('Container', { children: [node('Section')] })))).toEqual([]);
    expect(rules(withHome(node('Card', { children: [node('Modal')] })))).toEqual(['V-12']);
    expect(rules(withHome(node('Form', { children: [node('Form')] })))).toEqual(['V-13']);
  });

  it('keeps layout properties on the right nodes and parents [V-26, V-27]', () => {
    expect(rules(withHome(node('Text', { style: { gap: { px: 4 } } })))).toEqual(['V-26']);
    expect(rules(withHome(node('Stack', { style: { columns: 3 } })))).toEqual(['V-26']);
    expect(
      rules(withHome(node('Grid', { children: [node('Card', { style: { colSpan: 2 } })] }))),
    ).toEqual([]);
    expect(
      rules(
        withHome(
          node('Stack', { children: [node('Card', { responsive: { md: { colSpan: 2 } } })] }),
        ),
      ),
    ).toEqual(['V-27']);
    expect(
      rules(withHome(node('Grid', { children: [node('Card', { style: { grow: true } })] }))),
    ).toEqual(['V-27']);
  });

  it('needs unique field names in a form [V-23]', () => {
    const input = () =>
      node('Input', {
        content: { kind: 'input', label: 'x', inputType: 'text', fieldName: 'dup' },
      });

    expect(rules(withHome(node('Form', { children: [input(), input()] })))).toEqual(['V-23']);
  });

  it('matches instance slots and props to the component [V-18, V-56]', () => {
    const instance = node('ComponentInstance', {
      content: { kind: 'instance', componentId: CARD, propValues: { nope: 'x' } },
      slots: { other: [] },
    });

    expect(rules(withHome(instance))).toEqual(['V-18', 'V-56']);
  });

  it('forbids components that use themselves [V-17]', () => {
    const document = baseDocument();
    const component = document.components[CARD] as UserComponent;
    component.root.children?.push(
      node('ComponentInstance', {
        content: { kind: 'instance', componentId: CARD, propValues: {} },
      }),
    );

    expect(rules(document)).toContain('V-17');
  });

  it('needs bindings that exist in the catalog and fit the node [V-30]', () => {
    expect(
      rules(
        withHome(
          node('List', {
            bindings: { items: { source: 'ds_missing', endpoint: EP.list } },
            children: [node('Card')],
          }),
        ),
      ),
    ).toEqual(['V-30']);
    expect(
      rules(
        withHome(
          node('List', {
            bindings: { items: { source: 'ds_products', endpoint: EP.detail } },
            children: [node('Card')],
          }),
        ),
      ),
    ).toEqual(['V-30']);
    expect(
      rules(
        withHome(node('Divider', { bindings: { text: { source: 'ds_products', field: 'name' } } })),
      ),
    ).toEqual(['none']);
  });

  it('reads field bindings from the record in context, through relations [V-30, V-31]', () => {
    const inList = (child: DesignNode) =>
      node('List', {
        bindings: { items: { source: 'ds_products', endpoint: EP.list } },
        children: [child],
      });

    expect(
      rules(
        withHome(
          inList(
            node('Text', { bindings: { text: { source: 'ds_products', field: 'category.name' } } }),
          ),
        ),
      ),
    ).toEqual([]);
    expect(
      rules(
        withHome(
          inList(node('Text', { bindings: { text: { source: 'ds_products', field: 'nope' } } })),
        ),
      ),
    ).toEqual(['V-30']);
    expect(
      rules(
        withHome(
          inList(node('Image', { bindings: { src: { source: 'ds_products', field: 'name' } } })),
        ),
      ),
    ).toEqual(['V-30']);
    expect(
      rules(
        withHome(node('Text', { bindings: { text: { source: 'ds_products', field: 'name' } } })),
      ),
    ).toEqual(['V-31']);
  });

  it('needs interaction targets on the same page [V-92]', () => {
    const document = withHome(
      node('Button', { interactions: [click([{ type: 'openModal', modalId: 'n_missing001' }])] }),
      node('Button', { interactions: [click([{ type: 'toggle', targetId: 'n_missing001' }])] }),
      node('Button', {
        interactions: [
          click([{ type: 'refreshData', targetId: (baseDocument().pages[HOME] as Page).root.id }]),
        ],
      }),
    );

    expect(rules(document)).toEqual(['V-92']);
    expect(validateDocument(document).filter((detail) => detail.rule === 'V-92')).toHaveLength(3);
  });

  it('needs existing target pages with every route parameter [V-93]', () => {
    expect(
      rules(
        withHome(
          node('Button', { interactions: [click([{ type: 'navigate', pageId: PRODUCT }])] }),
        ),
      ),
    ).toEqual(['V-93']);
    expect(
      rules(
        withHome(
          node('Button', { interactions: [click([{ type: 'navigate', pageId: 'p_none000001' }])] }),
        ),
      ),
    ).toEqual(['V-93']);
  });

  it('needs a record in context for field parameters and deletes [V-94]', () => {
    const deleteAction = {
      type: 'deleteRecord',
      endpoint: EP.remove,
      confirm: { title: 'Delete?', message: 'Sure?' },
    } as const;
    const fieldParam = click([
      { type: 'navigate', pageId: PRODUCT, params: { id: { kind: 'field', field: 'id' } } },
    ]);

    expect(rules(withHome(node('Button', { interactions: [fieldParam] })))).toEqual(['V-94']);
    expect(rules(withHome(node('Button', { interactions: [click([deleteAction])] })))).toEqual([
      'V-94',
    ]);
    const table = node('Table', {
      content: {
        kind: 'table',
        columns: [{ id: 'name', header: 'Name', field: 'name' }],
        emptyText: '-',
        rowActions: [{ id: 'del', label: 'Delete', tone: 'danger', actions: [deleteAction] }],
      },
      bindings: { rows: { source: 'ds_products', endpoint: EP.list } },
    });
    expect(rules(withHome(table))).toEqual([]);
  });

  it('closes the surrounding Modal only from inside one [V-96]', () => {
    const close = click([{ type: 'closeModal' }]);

    expect(rules(withHome(node('Button', { interactions: [close] })))).toEqual(['V-96']);
    expect(
      rules(withHome(node('Modal', { children: [node('Button', { interactions: [close] })] }))),
    ).toEqual([]);
  });
});

describe('checkDocument', () => {
  it('returns the document when schema and rules pass', () => {
    expect(checkDocument(baseDocument()).ok).toBe(true);
  });

  it('reports schema violations as E004 with rule codes [V-21]', () => {
    const document = withHome(node('Text', { content: { kind: 'none' } }));
    const result = checkDocument(document);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('E004');
    expect(result.error.details?.some((detail) => detail.rule === 'V-21')).toBe(true);
  });

  it('reports rule violations as E004 [V-13]', () => {
    const result = checkDocument(withHome(node('Form', { children: [node('Form')] })));

    expect(result.ok ? [] : result.error.details?.map((detail) => detail.rule)).toEqual(['V-13']);
  });
});
