// Helpers shared by the Studio tests. Not used by production code.
import { createDefaultTokens, type DesignDocument } from '@reactcraft/model';
import { vi } from 'vitest';

import type { HistoryStorage } from './history-persistence.ts';

/** Home (Stack > Card > Text) and an empty About page. */
function samplePages(): DesignDocument['pages'] {
  return {
    p_home000001: {
      schemaVersion: 1,
      id: 'p_home000001',
      name: 'Home',
      route: '/',
      root: {
        id: 'n_root000001',
        type: 'Stack',
        content: { kind: 'none' },
        children: [
          {
            id: 'n_card000001',
            type: 'Card',
            content: { kind: 'none' },
            children: [
              {
                id: 'n_text000001',
                type: 'Text',
                content: { kind: 'text', text: 'Original text' },
              },
            ],
          },
        ],
      },
    },
    p_about00001: {
      schemaVersion: 1,
      id: 'p_about00001',
      name: 'About',
      route: '/about',
      root: { id: 'n_root000002', type: 'Stack', content: { kind: 'none' } },
    },
  };
}

/** A workspace "Shop" with one page: Stack > Card > Text, and two frames. */
export function sampleDocument(revision = 1): DesignDocument {
  return {
    workspace: {
      schemaVersion: 1,
      id: 'ws00000001',
      name: 'Shop',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      revision,
      pageOrder: ['p_home000001', 'p_about00001'],
      backends: [],
      responsiveMode: 'desktop-first',
      frames: [
        { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
        { id: 'mobile', label: 'Mobile', width: 375, height: 812 },
      ],
      primaryFrameId: 'desktop',
      contentLocale: 'vi-VN',
      darkMode: 'none',
    },
    tokens: createDefaultTokens(),
    pages: samplePages(),
    components: {},
    dataSources: { schemaVersion: 1, auth: { kind: 'none' }, entities: [], endpoints: [] },
  };
}

/** A text change on the sample page. */
export const setText = (text: string) =>
  ({
    op: 'setContent',
    target: { kind: 'page', pageId: 'p_home000001' },
    nodeId: 'n_text000001',
    set: { text },
  }) as const;

/** Stubs `fetch`, answering each API path (after `/api/v1/`) with `{ data }`. */
export function stubApi(routes: Readonly<Record<string, unknown>>) {
  const fetchMock = vi.fn((url: string) => {
    const path = url.replace('/api/v1/', '');
    const data = routes[path];
    return Promise.resolve(
      data === undefined
        ? new Response(JSON.stringify({ error: { code: 'E015' } }), { status: 404 })
        : new Response(JSON.stringify({ data }), { status: 200 }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** In-memory history storage; a missing key reads as undefined, which callers treat as empty. */
export function memoryStorage(): HistoryStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) as string,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}
