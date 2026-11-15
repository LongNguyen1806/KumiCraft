// Tests for K9.8-1 Group 10 (MCP): all 8 new interaction tools + state/dark/run extensions.
import type { ElementSource } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import type { ApiClient, ApiResult } from './api-client.ts';
import { MCP_TOOLS } from './mcp-tools.ts';

type Sent = {
  readonly method: 'GET' | 'POST' | 'PATCH';
  readonly path: string;
  readonly body?: unknown;
};

const HASH = 'b'.repeat(64);

function makeElement(loc: string, overrides: Partial<ElementSource> = {}): ElementSource {
  return {
    loc,
    tag: 'button',
    fileHash: HASH,
    className: { kind: 'static', value: 'p-4 rounded' },
    text: { kind: 'static', value: 'Action' },
    attributes: {},
    inLoop: false,
    ...overrides,
  };
}

function createFakeApi(elements: Readonly<Record<string, ElementSource>>) {
  const sent: Sent[] = [];
  const ok = (data: unknown): Promise<ApiResult> => Promise.resolve({ ok: true, data });
  const api: ApiClient = {
    get(path, query) {
      sent.push({ method: 'GET', path });
      const loc = query?.['loc'];
      if (path === 'source/element' && loc !== undefined) {
        const found = elements[loc];
        return found ? ok(found) : Promise.resolve({ ok: false, message: 'E017: Not found' });
      }
      return ok({});
    },
    post(path, body) {
      sent.push({ method: 'POST', path, body });
      return ok({ changed: true, enabled: true });
    },
    patch(path, body) {
      sent.push({ method: 'PATCH', path, body });
      return ok({});
    },
  };
  return { api, sent };
}

function callTool(name: string, api: ApiClient, args: unknown): Promise<ApiResult> {
  const tool = MCP_TOOLS.find((t) => t.name === name);
  if (tool === undefined) throw new Error(`Missing MCP tool: ${name}`);
  return tool.run(api, tool.input.parse(args));
}

describe('MCP interaction tools & state/dark/run updates (K9.8-1 Group 10)', () => {
  it('supports state & dark on kumicraft_update_classes and run on kumicraft_set_text', async () => {
    const loc = 'src/App.tsx:10:5';
    const { api, sent } = createFakeApi({
      [loc]: makeElement(loc, {
        tag: 'h3',
        text: {
          kind: 'mixed',
          runs: [
            { kind: 'element', tag: 'svg', iconName: 'battery' },
            { kind: 'text', runIndex: 0, value: 'Pin & USB' },
          ],
        },
      }),
    });

    const clsRes = await callTool('kumicraft_update_classes', api, {
      loc,
      state: 'selected',
      dark: true,
      add: ['bg-[#0f172a]'],
    });
    expect(clsRes.ok).toBe(true);
    const clsPost = sent.find((s) => s.path === 'source/edits')?.body as {
      readonly edit?: { readonly after?: string };
    };
    expect(clsPost.edit?.after).toContain('dark:data-[selected=true]:bg-[#0f172a]');

    const runRes = await callTool('kumicraft_set_text', api, { loc, run: 0, text: 'Pin 40h' });
    expect(runRes.ok).toBe(true);
    const runPost = sent.filter((s) => s.path === 'source/edits').at(-1)?.body as {
      readonly edit?: {
        readonly kind?: string;
        readonly index?: number;
        readonly before?: string;
        readonly after?: string;
      };
    };
    expect(runPost.edit).toEqual({
      kind: 'setTextRun',
      loc,
      tag: 'h3',
      index: 0,
      before: 'Pin & USB',
      after: 'Pin 40h',
    });
  });

  it('invokes all 8 interaction MCP tools with expected HTTP payloads', async () => {
    const c1 = 'src/App.tsx:11:7';
    const c2 = 'src/App.tsx:12:7';
    const grp = 'src/App.tsx:10:5';
    const panel = 'src/App.tsx:20:5';
    const btn = 'src/App.tsx:30:5';
    const nav = 'src/App.tsx:5:5';

    const { api, sent } = createFakeApi({
      [c1]: makeElement(c1, { tag: 'div' }),
      [c2]: makeElement(c2, { tag: 'div' }),
      [grp]: makeElement(grp, { tag: 'SelectGroup' }),
      [panel]: makeElement(panel, { tag: 'div' }),
      [btn]: makeElement(btn, { tag: 'button' }),
      [nav]: makeElement(nav, { tag: 'nav' }),
    });

    expect(
      (await callTool('kumicraft_make_select_group', api, { locs: [c1, c2], mode: 'multiple' })).ok,
    ).toBe(true);
    expect(
      (
        await callTool('kumicraft_link_select_content', api, {
          groupLoc: grp,
          itemLocs: [c1, c2],
          targetLoc: panel,
        })
      ).ok,
    ).toBe(true);
    expect((await callTool('kumicraft_remove_select_group', api, { groupLoc: grp })).ok).toBe(true);
    expect((await callTool('kumicraft_enable_dark_mode', api, { checkOnly: false })).ok).toBe(true);
    expect(
      (await callTool('kumicraft_make_loading_button', api, { loc: btn, loadingText: 'Saving...' }))
        .ok,
    ).toBe(true);
    expect(
      (
        await callTool('kumicraft_set_link_target', api, {
          loc: btn,
          targetKind: 'external',
          target: 'https://kumicraft.dev',
          newTab: true,
        })
      ).ok,
    ).toBe(true);
    expect((await callTool('kumicraft_mark_active_nav', api, { loc: nav })).ok).toBe(true);

    const posts = sent.filter((s) => s.method === 'POST').map((s) => s.path);
    expect(posts).toContain('project/dark-mode');
    expect(posts.filter((p) => p === 'source/interaction')).toHaveLength(6);
  });
});
