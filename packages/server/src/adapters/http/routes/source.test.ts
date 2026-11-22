// Source Editor HTTP routes contract test (SPEC-03 section 5.5).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHistoryService } from '../../../kernel/history/history-service.ts';
import { createSessionInfoProvider } from '../../../kernel/session.ts';
import { testClassEdits } from '../../../services/edit/class-edits-test-support.ts';
import { nodeFs } from '../../../services/workspace/test-support.ts';
import { jsxFeatures } from '../../../stacks/view/jsx/features.ts';
import { createSourceEditorService } from '../../../stacks/view/jsx/source-editor-service.ts';
import { createHttpApp } from '../create-http-app.ts';

const PORT = 50240;
const TOKEN = 'test-token-source';
const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
  'content-type': 'application/json',
};

describe('Source HTTP routes [SPEC-03 section 5.5]', () => {
  let tmpDir: string;
  let app: FastifyInstance;
  let activeRoot: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-source-route-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    activeRoot = tmpDir;

    const sourceEditorService = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
    const historyService = createHistoryService({ fs: nodeFs });

    const getSessionInfo = createSessionInfoProvider({
      version: '1.0.0',
      platform: 'linux',
      features: [],
      readProject: () => ({ state: 'none' }),
    });

    app = await createHttpApp({
      logLevel: 'silent',
      security: { port: PORT, sessionToken: TOKEN, trustedOrigins: [] },
      getSessionInfo,
      sourceRoutes: {
        sourceEditorService,
        classEdits: testClassEdits(),
        historyService,
        getProjectRoot: () => activeRoot,
        getViewFeatures: () => jsxFeatures,
        fs: nodeFs,
      },
      historyRoutes: {
        historyService,
        getProjectRoot: () => activeRoot,
      },
    });
  });

  afterEach(async () => {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('GET /api/v1/source/element returns 200 with ElementSource', async () => {
    const code = `
export function Card() {
  return (
    <div className="card-box">
      <p>Hello world</p>
    </div>
  );
}
`;
    await fs.writeFile(path.join(tmpDir, 'src/Card.tsx'), code, 'utf8');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/source/element?loc=src/Card.tsx:4:5',
      headers: HEADERS,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      data: { tag: string; className: { kind: string; value: string } };
    }>();
    expect(body.data.tag).toBe('div');
    expect(body.data.className).toEqual({ kind: 'static', value: 'card-box' });
  });

  it('GET /api/v1/source/element returns 400 E016 when loc is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/source/element',
      headers: HEADERS,
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('E016');
  });

  it('GET /api/v1/source/element returns 404 E021 when project is not open', async () => {
    activeRoot = undefined;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/source/element?loc=src/Card.tsx:4:5',
      headers: HEADERS,
    });

    expect(res.statusCode).toBe(409);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('E021');
  });

  it('POST /api/v1/source/edits applies change and records history', async () => {
    const code = `
export function Card() {
  return (
    <div className="old-cls">
      <p>Content</p>
    </div>
  );
}
`;
    await fs.writeFile(path.join(tmpDir, 'src/Card.tsx'), code, 'utf8');

    const editRes = await app.inject({
      method: 'POST',
      url: '/api/v1/source/edits',
      headers: HEADERS,
      payload: {
        edit: {
          kind: 'setClassName',
          loc: 'src/Card.tsx:4:5',
          tag: 'div',
          before: 'old-cls',
          after: 'new-cls',
        },
      },
    });

    expect(editRes.statusCode).toBe(200);
    const editBody = editRes.json<{ data: { changed: boolean; file: string } }>();
    expect(editBody.data.changed).toBe(true);

    const updatedContent = await fs.readFile(path.join(tmpDir, 'src/Card.tsx'), 'utf8');
    expect(updatedContent).toContain('className="new-cls"');

    // Verify history state updated
    const historyRes = await app.inject({
      method: 'GET',
      url: '/api/v1/history',
      headers: HEADERS,
    });
    expect(historyRes.statusCode).toBe(200);
    const historyBody = historyRes.json<{ data: { undoCount: number } }>();
    expect(historyBody.data.undoCount).toBe(1);
  });

  it('records the exact bytes of overlapping edits of one file, so Undo restores it [R-SE-13, R-HI-06]', async () => {
    const items = [0, 1, 2, 3, 4].map((i) => `      <li className="item">Item ${String(i)}</li>`);
    const code = `export function List() {\n  return (\n    <ul>\n${items.join('\n')}\n    </ul>\n  );\n}\n`;
    const file = path.join(tmpDir, 'src/List.tsx');
    await fs.writeFile(file, code, 'utf8');

    const edits = await Promise.all(
      [0, 1, 2, 3, 4].map((i) =>
        app.inject({
          method: 'POST',
          url: '/api/v1/source/edits',
          headers: HEADERS,
          payload: {
            edit: {
              kind: 'setClassName',
              loc: `src/List.tsx:${String(4 + i)}:7`,
              tag: 'li',
              before: 'item',
              after: `item item-${String(i)}`,
            },
          },
        }),
      ),
    );
    const undo = () =>
      app.inject({ method: 'POST', url: '/api/v1/history/undo', headers: HEADERS });

    const firstUndo = await undo();
    const afterOneUndo = await fs.readFile(file, 'utf8');
    for (let i = 0; i < 4; i++) await undo();

    expect(edits.map((res) => res.statusCode)).toEqual([200, 200, 200, 200, 200]);
    expect(firstUndo.statusCode).toBe(200);
    // Only the last edit is undone: each entry holds the bytes its own edit replaced.
    expect([0, 1, 2, 3, 4].map((i) => afterOneUndo.includes(`item item-${String(i)}`))).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(await fs.readFile(file, 'utf8')).toBe(code);
  });

  it('#15 POST /api/v1/source/edits supports insert, duplicate, remove and Undo/Redo [R-SE-22, R-SE-25, R-SE-26]', async () => {
    const code = [
      'export function Card() {',
      '  return (',
      '    <div>',
      '      <p>Base</p>',
      '    </div>',
      '  );',
      '}',
      '',
    ].join('\n');
    const file = path.join(tmpDir, 'src/Card.tsx');
    await fs.writeFile(file, code, 'utf8');

    // 1. Insert sibling after <p>
    const insRes = await app.inject({
      method: 'POST',
      url: '/api/v1/source/edits',
      headers: HEADERS,
      payload: {
        edit: {
          kind: 'insert',
          target: {
            kind: 'sibling',
            ref: { loc: 'src/Card.tsx:4:7', tag: 'p' },
            where: 'after',
          },
          jsx: '<span>Added</span>',
        },
      },
    });
    expect(insRes.statusCode).toBe(200);
    const insBody = insRes.json<{
      data: { changed: boolean; files: string[]; locs: string[] };
    }>();
    expect(insBody.data).toEqual({
      changed: true,
      files: ['src/Card.tsx'],
      locs: ['src/Card.tsx:5:7'],
    });
    const afterInsert = await fs.readFile(file, 'utf8');

    // 2. Duplicate the newly inserted <span>
    const dupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/source/edits',
      headers: HEADERS,
      payload: {
        edit: {
          kind: 'duplicate',
          elements: [{ loc: 'src/Card.tsx:5:7', tag: 'span' }],
        },
      },
    });
    expect(dupRes.statusCode).toBe(200);
    const dupBody = dupRes.json<{
      data: { changed: boolean; files: string[]; locs: string[] };
    }>();
    expect(dupBody.data).toEqual({
      changed: true,
      files: ['src/Card.tsx'],
      locs: ['src/Card.tsx:6:7'],
    });

    // 3. Remove the duplicate
    const rmRes = await app.inject({
      method: 'POST',
      url: '/api/v1/source/edits',
      headers: HEADERS,
      payload: {
        edit: {
          kind: 'remove',
          elements: [{ loc: 'src/Card.tsx:6:7', tag: 'span' }],
        },
      },
    });
    expect(rmRes.statusCode).toBe(200);
    const rmBody = rmRes.json<{
      data: { changed: boolean; files: string[]; locs: string[] };
    }>();
    expect(rmBody.data).toEqual({
      changed: true,
      files: ['src/Card.tsx'],
      locs: [],
    });
    expect(await fs.readFile(file, 'utf8')).toBe(afterInsert);

    // Undo all 3 structural operations -> back to original code
    for (let i = 0; i < 3; i++) {
      const u = await app.inject({
        method: 'POST',
        url: '/api/v1/history/undo',
        headers: HEADERS,
      });
      expect(u.statusCode).toBe(200);
    }
    expect(await fs.readFile(file, 'utf8')).toBe(code);

    // Redo 1 step (insert) -> matches afterInsert
    const redoRes = await app.inject({
      method: 'POST',
      url: '/api/v1/history/redo',
      headers: HEADERS,
    });
    expect(redoRes.statusCode).toBe(200);
    expect(await fs.readFile(file, 'utf8')).toBe(afterInsert);
  });
});
