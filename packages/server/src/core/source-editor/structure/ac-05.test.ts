// AC-05 (SRS) on the new-project template: the Library Card goes in between two sections of Home;
// move, duplicate and remove each make one Undo step; undoing everything restores the file byte for
// byte. The Canvas part (dragging the block) is covered by the G2 manual test (spec-log #34).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { LIBRARY_BLOCKS, renderBlock, type StructureEdit } from '@kumicraft/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHttpApp } from '../../../adapters/http/create-http-app.ts';
import { resolveTemplateDir } from '../../../index.ts';
import { createHistoryService } from '../../history/history-service.ts';
import { createSessionInfoProvider } from '../../shared/session.ts';
import { nodeFs } from '../../workspace/test-support.ts';
import { createSourceEditorService } from '../source-editor-service.ts';

const PORT = 50242;
const TOKEN = 'test-token-ac05';
const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
  'content-type': 'application/json',
};
const HOME = 'src/pages/Home.tsx';
const CARD_MARKER = 'min-w-0 p-6 bg-white border border-gray-200 rounded-lg shadow-sm';

/** Loc of the first JSX element whose opening tag starts with `needle` (1-based line and column). */
function locOf(text: string, needle: string): string {
  const offset = text.indexOf(needle);
  expect(offset).toBeGreaterThanOrEqual(0);
  const before = text.slice(0, offset).split('\n');
  const column = (before.at(-1)?.length ?? 0) + 1;
  return `${HOME}:${String(before.length)}:${String(column)}`;
}

const count = (text: string, needle: string) => text.split(needle).length - 1;

describe('AC-05: Library Card, move, duplicate, remove on the template [AC-05]', () => {
  let tmpDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-ac05-'));
    await fs.cp(path.join(resolveTemplateDir(), 'src'), path.join(tmpDir, 'src'), {
      recursive: true,
    });
    const historyService = createHistoryService({ fs: nodeFs });
    app = await createHttpApp({
      logLevel: 'silent',
      security: { port: PORT, sessionToken: TOKEN, trustedOrigins: [] },
      getSessionInfo: createSessionInfoProvider({
        version: '1.0.0',
        platform: 'linux',
        features: [],
        readProject: () => ({ state: 'none' }),
      }),
      sourceRoutes: {
        sourceEditorService: createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' }),
        historyService,
        getProjectRoot: () => tmpDir,
        fs: nodeFs,
      },
      historyRoutes: { historyService, getProjectRoot: () => tmpDir },
    });
  });

  afterEach(async () => {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const readHome = () => fs.readFile(path.join(tmpDir, HOME), 'utf8');

  async function edit(body: StructureEdit): Promise<readonly string[]> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/source/edits',
      headers: HEADERS,
      payload: { edit: body },
    });
    expect(res.statusCode).toBe(200);
    return res.json<{ data: { locs?: readonly string[] } }>().data.locs ?? [];
  }

  async function undoCount(): Promise<number> {
    const res = await app.inject({ method: 'GET', url: '/api/v1/history', headers: HEADERS });
    return res.json<{ data: { undoCount: number } }>().data.undoCount;
  }

  it('places the Card between the hero and the products, one Undo step per operation, full undo is byte-exact', async () => {
    const original = await readHome();
    const card = LIBRARY_BLOCKS.find((block) => block.id === 'composite.card');
    expect(card).toBeDefined();
    if (!card) return;

    // 1. Insert the Card after the hero section: it lands between the two sections.
    const heroLoc = locOf(original, '<section className="grid');
    const [cardLoc] = await edit({
      kind: 'insert',
      target: { kind: 'sibling', ref: { loc: heroLoc, tag: 'section' }, where: 'after' },
      jsx: renderBlock(card, 'tailwind4', 'en').jsx,
    });
    let home = await readHome();
    expect(home.indexOf('</section>')).toBeLessThan(home.indexOf(CARD_MARKER));
    expect(home.indexOf(CARD_MARKER)).toBeLessThan(home.indexOf('Featured products'));
    expect(cardLoc).toBe(locOf(home, `<div className="${CARD_MARKER}`));
    expect(await undoCount()).toBe(1);

    // 2. Move the Card above the hero section.
    await edit({
      kind: 'move',
      elements: [{ loc: locOf(home, `<div className="${CARD_MARKER}`), tag: 'div' }],
      target: {
        kind: 'sibling',
        ref: { loc: locOf(home, '<section className="grid'), tag: 'section' },
        where: 'before',
      },
    });
    home = await readHome();
    expect(home.indexOf(CARD_MARKER)).toBeLessThan(home.indexOf('<section className="grid'));
    expect(count(home, CARD_MARKER)).toBe(1);
    expect(await undoCount()).toBe(2);

    // 3. Duplicate it.
    await edit({
      kind: 'duplicate',
      elements: [{ loc: locOf(home, `<div className="${CARD_MARKER}`), tag: 'div' }],
    });
    home = await readHome();
    expect(count(home, CARD_MARKER)).toBe(2);
    expect(await undoCount()).toBe(3);

    // 4. Remove the first product card of the template.
    await edit({
      kind: 'remove',
      elements: [{ loc: locOf(home, '<ProductCard'), tag: 'ProductCard' }],
    });
    home = await readHome();
    expect(home).not.toContain('Oak Lounge Chair');
    expect(count(home, '<ProductCard')).toBe(2);
    expect(await undoCount()).toBe(4);

    // Each operation is one step: four undos bring back the template byte for byte.
    for (let step = 0; step < 4; step++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/history/undo',
        headers: HEADERS,
      });
      expect(res.statusCode).toBe(200);
    }
    expect(await readHome()).toBe(original);
    expect(await undoCount()).toBe(0);
  });
});
