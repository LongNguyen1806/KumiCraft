// Edit tools of `kumicraft mcp` (R-AG-19, round 7b): each reads the element first and sends the
// same edit the Studio sends, so the server's checks and the history apply unchanged.
import type { ElementSource } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import type { ApiClient, ApiResult } from './api-client.ts';
import { MCP_TOOLS } from './mcp-tools.ts';

type Sent = {
  readonly method: 'GET' | 'POST' | 'PATCH';
  readonly path: string;
  readonly body?: unknown;
};

const HASH = 'a'.repeat(64);

function element(loc: string, overrides: Partial<ElementSource> = {}): ElementSource {
  return {
    loc,
    tag: 'button',
    fileHash: HASH,
    className: { kind: 'static', value: 'rounded bg-blue-600 px-4' },
    text: { kind: 'static', value: 'Mua ngay' },
    attributes: {},
    inLoop: false,
    ...overrides,
  };
}

function fakeApi(elements: Readonly<Record<string, ElementSource>>) {
  const sent: Sent[] = [];
  const ok = (data: unknown): Promise<ApiResult> => Promise.resolve({ ok: true, data });
  const api: ApiClient = {
    get(path, query) {
      sent.push({ method: 'GET', path });
      const found = query?.['loc'] === undefined ? undefined : elements[query['loc']];
      if (path === 'source/element') {
        return found === undefined
          ? Promise.resolve({ ok: false, message: 'E017: The source changed since it was read.' })
          : ok(found);
      }
      return ok({});
    },
    post(path, body) {
      sent.push({ method: 'POST', path, body });
      return ok({ changed: true });
    },
    patch(path, body) {
      sent.push({ method: 'PATCH', path, body });
      return ok({});
    },
  };
  return { api, sent, writes: () => sent.filter((call) => call.method !== 'GET') };
}

function run(name: string, api: ApiClient, args: unknown): Promise<ApiResult> {
  const tool = MCP_TOOLS.find((item) => item.name === name);
  if (tool === undefined) throw new Error(`no tool ${name}`);
  return tool.run(api, tool.input.parse(args));
}

const BTN = 'src/pages/Home.tsx:13:9';
const H1 = 'src/pages/Home.tsx:11:9';

describe('MCP edit tools [R-AG-19]', () => {
  it('replaces and updates class names with the current value as the guard [R-AG-19]', async () => {
    const { api, writes } = fakeApi({ [BTN]: element(BTN) });

    await run('kumicraft_set_class_name', api, { loc: BTN, className: ' rounded bg-red-600 ' });
    await run('kumicraft_update_classes', api, {
      loc: BTN,
      add: ['bg-red-600', 'shadow'],
      remove: ['bg-blue-600'],
    });

    expect(writes().map((call) => call.body)).toEqual([
      {
        edit: {
          kind: 'setClassName',
          loc: BTN,
          tag: 'button',
          before: 'rounded bg-blue-600 px-4',
          after: 'rounded bg-red-600',
        },
      },
      {
        edit: {
          kind: 'setClassName',
          loc: BTN,
          tag: 'button',
          before: 'rounded bg-blue-600 px-4',
          after: 'rounded px-4 bg-red-600 shadow',
        },
      },
    ]);
  });

  it('refuses a dynamic className or mixed text without writing [R-AG-19, E023]', async () => {
    const { api, writes } = fakeApi({
      [BTN]: element(BTN, {
        className: { kind: 'expression', code: 'cn(a)' },
        text: { kind: 'mixed' },
      }),
    });

    const classes = await run('kumicraft_set_class_name', api, { loc: BTN, className: 'x' });
    const text = await run('kumicraft_set_text', api, { loc: BTN, text: 'Hi' });

    expect(classes.ok || classes.message).toMatch(/^E023/);
    expect(text.ok || text.message).toMatch(
      /^E023: the text of this element is not plain text \(mixed\)/,
    );
    expect(writes()).toEqual([]);
  });

  it('sets text and sets or removes an attribute [R-AG-19]', async () => {
    const link = 'src/pages/Home.tsx:15:9';
    const { api, writes } = fakeApi({
      [BTN]: element(BTN),
      [link]: element(link, { tag: 'a', attributes: { href: { kind: 'static', value: '/old' } } }),
    });

    await run('kumicraft_set_text', api, { loc: BTN, text: 'Đặt hàng' });
    await run('kumicraft_set_attribute', api, { loc: link, name: 'href', value: '/new' });
    await run('kumicraft_set_attribute', api, { loc: link, name: 'href' });

    expect(writes().map((call) => call.body)).toEqual([
      { edit: { kind: 'setText', loc: BTN, tag: 'button', before: 'Mua ngay', after: 'Đặt hàng' } },
      {
        edit: {
          kind: 'setAttribute',
          loc: link,
          tag: 'a',
          name: 'href',
          before: '/old',
          after: '/new',
        },
      },
      { edit: { kind: 'setAttribute', loc: link, tag: 'a', name: 'href', before: '/old' } },
    ]);
  });

  it('turns where into sibling or child targets for inserts and moves [R-AG-19]', async () => {
    const { api, writes } = fakeApi({ [BTN]: element(BTN), [H1]: element(H1, { tag: 'h1' }) });

    await run('kumicraft_insert_jsx', api, {
      target: { loc: BTN, where: 'after' },
      jsx: '<p>Free shipping</p>',
    });
    await run('kumicraft_move_elements', api, {
      locs: [H1],
      target: { loc: BTN, where: 'inside-end' },
    });
    await run('kumicraft_insert_image', api, {
      target: { loc: H1, where: 'before' },
      src: '/hero.png',
      alt: 'Hero',
    });

    expect(writes().map((call) => call.body)).toEqual([
      {
        edit: {
          kind: 'insert',
          target: { kind: 'sibling', ref: { loc: BTN, tag: 'button' }, where: 'after' },
          jsx: '<p>Free shipping</p>',
        },
      },
      {
        edit: {
          kind: 'move',
          elements: [{ loc: H1, tag: 'h1' }],
          target: { kind: 'child', parent: { loc: BTN, tag: 'button' }, where: 'end' },
        },
      },
      {
        edit: {
          kind: 'insertImage',
          target: { kind: 'sibling', ref: { loc: H1, tag: 'h1' }, where: 'before' },
          image: { kind: 'existing', src: '/hero.png' },
          alt: 'Hero',
          className: '',
        },
      },
    ]);
  });

  it('removes, duplicates, wraps and unwraps several elements by their guards [R-AG-19]', async () => {
    const { api, writes } = fakeApi({ [BTN]: element(BTN), [H1]: element(H1, { tag: 'h1' }) });
    const guards = [
      { loc: H1, tag: 'h1' },
      { loc: BTN, tag: 'button' },
    ];

    await run('kumicraft_remove_elements', api, { locs: [H1, BTN] });
    await run('kumicraft_duplicate_elements', api, { locs: [H1, BTN] });
    await run('kumicraft_wrap_elements', api, { locs: [H1, BTN], wrapper: 'row' });
    await run('kumicraft_unwrap_element', api, { loc: BTN });

    expect(writes().map((call) => call.body)).toEqual([
      { edit: { kind: 'remove', elements: guards } },
      { edit: { kind: 'duplicate', elements: guards } },
      { edit: { kind: 'wrap', elements: guards, wrapper: 'row' } },
      { edit: { kind: 'unwrap', element: { loc: BTN, tag: 'button' } } },
    ]);
  });

  it('stops before writing when an element moved [R-AG-19, E017]', async () => {
    const { api, writes } = fakeApi({ [BTN]: element(BTN) });

    const result = await run('kumicraft_remove_elements', api, { locs: [BTN, 'src/x.tsx:1:1'] });

    expect(result.ok || result.message).toMatch(/^E017/);
    expect(writes()).toEqual([]);
  });

  it('creates pages, edits theme tokens and undoes or redoes through the API [R-AG-19]', async () => {
    const { api, writes } = fakeApi({});

    await run('kumicraft_create_page', api, { name: 'Pricing', path: '/pricing' });
    await run('kumicraft_set_theme_token', api, {
      op: 'set',
      kind: 'color',
      name: 'brand',
      value: '#e11d48',
    });
    await run('kumicraft_undo', api, {});
    await run('kumicraft_redo', api, {});

    expect(writes()).toEqual([
      { method: 'POST', path: 'project/pages', body: { name: 'Pricing', path: '/pricing' } },
      {
        method: 'PATCH',
        path: 'project/theme',
        body: { op: 'set', kind: 'color', name: 'brand', value: '#e11d48' },
      },
      { method: 'POST', path: 'history/undo', body: {} },
      { method: 'POST', path: 'history/redo', body: {} },
    ]);
  });

  it('Test 2 & Test 6 (MCP): supports kumicraft_set_tag & extended kumicraft_set_attribute with unsafe rejections', async () => {
    const { api, writes } = fakeApi({ [BTN]: element(BTN), [H1]: element(H1, { tag: 'h1' }) });

    await run('kumicraft_set_tag', api, { loc: H1, tag: 'h2' });
    await run('kumicraft_set_attribute', api, { loc: BTN, name: 'id', value: 'buy-btn' });
    await run('kumicraft_set_attribute', api, {
      loc: BTN,
      name: 'aria-label',
      value: 'Buy item',
    });

    expect(writes().map((call) => call.body)).toEqual([
      { edit: { kind: 'setTag', loc: H1, tag: 'h1', after: 'h2' } },
      { edit: { kind: 'setAttribute', loc: BTN, tag: 'button', name: 'id', after: 'buy-btn' } },
      {
        edit: {
          kind: 'setAttribute',
          loc: BTN,
          tag: 'button',
          name: 'aria-label',
          after: 'Buy item',
        },
      },
    ]);

    expect(() =>
      MCP_TOOLS.find((t) => t.name === 'kumicraft_set_attribute')?.input.parse({
        loc: BTN,
        name: 'onClick',
        value: 'x',
      }),
    ).toThrow();
    expect(() =>
      MCP_TOOLS.find((t) => t.name === 'kumicraft_set_tag')?.input.parse({
        loc: H1,
        tag: 'script',
      }),
    ).toThrow();
  });

  it('Test 7 (MCP): kumicraft_insert_block renders block using project theme brand color for Tailwind & CSS', async () => {
    const makeProjectApi = (system: 'tailwind' | 'css') => {
      const posted: Sent[] = [];
      const customApi: ApiClient = {
        get(path) {
          if (path === 'source/element')
            return Promise.resolve({ ok: true, data: element(BTN, { tag: 'div' }) });
          if (path === 'project') {
            return Promise.resolve({
              ok: true,
              data: {
                support: {
                  styling: {
                    systems: [
                      system === 'tailwind' ? { id: 'tailwind', version: '4' } : { id: 'css' },
                    ],
                    primary: system,
                    editable: true,
                    globalCss: ['src/index.css'],
                  },
                },
              },
            });
          }
          if (path === 'project/theme') {
            return Promise.resolve({
              ok: true,
              data: {
                colors: [{ name: 'brand', value: '#e11d48', variable: '--brand' }],
                fontSizes: [],
                radii: [],
                fonts: [],
                shadows: [],
                breakpoints: [],
              },
            });
          }
          return Promise.resolve({ ok: true, data: {} });
        },
        post(path, body) {
          posted.push({ method: 'POST', path, body });
          return Promise.resolve({ ok: true, data: { changed: true } });
        },
        patch(path, body) {
          posted.push({ method: 'PATCH', path, body });
          return Promise.resolve({ ok: true, data: {} });
        },
      };
      return { customApi, posted };
    };

    const tw = makeProjectApi('tailwind');
    const rTw = await run('kumicraft_insert_block', tw.customApi, {
      blockId: 'form.button',
      target: { loc: BTN, where: 'after' },
    });
    expect(rTw.ok).toBe(true);
    const twBody = JSON.stringify(tw.posted[0]?.body);
    expect(twBody).toContain('bg-brand');

    const cssProj = makeProjectApi('css');
    const rCss = await run('kumicraft_insert_block', cssProj.customApi, {
      blockId: 'form.button',
      target: { loc: BTN, where: 'after' },
    });
    expect(rCss.ok).toBe(true);
    const cssBody = JSON.stringify(cssProj.posted[0]?.body);
    expect(cssBody).toContain('.kc-button');
    expect(cssBody).toContain('var(--brand)');
  });
});
