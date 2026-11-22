// Test for batch edits and foreign expression warnings (R-CB-14, R-CB-15, R-HI).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHttpApp } from '../../../adapters/http/create-http-app.ts';
import { createHistoryService } from '../../../kernel/history/history-service.ts';
import { createSessionInfoProvider } from '../../../kernel/session.ts';
import { testClassEdits } from '../../../services/edit/class-edits-test-support.ts';
import { nodeFs } from '../../../services/workspace/test-support.ts';
import { jsxFeatures } from './features.ts';
import { createSourceEditorService } from './source-editor-service.ts';

const PORT = 50241;
const TOKEN = 'test-token-batch';
const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
  'content-type': 'application/json',
};

describe('M-SE: Batch Edits (Scenarios #1..#7) [R-CB-14, R-CB-15]', () => {
  let tmpDir: string;
  let app: FastifyInstance;
  let service: ReturnType<typeof createSourceEditorService>;
  let historyService: ReturnType<typeof createHistoryService>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-batch-test-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });

    service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
    historyService = createHistoryService({ fs: nodeFs });

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
        sourceEditorService: service,
        classEdits: testClassEdits(),
        historyService,
        getProjectRoot: () => tmpDir,
        getViewFeatures: () => jsxFeatures,
        fs: nodeFs,
      },
      historyRoutes: {
        historyService,
        getProjectRoot: () => tmpDir,
      },
    });
  });

  afterEach(async () => {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('Scenario 1: Batch edits className of 3 elements in same file with parent-child and same-line elements [R-CB-15]', async () => {
    const code = [
      'export function Home() {',
      '  return (',
      '    <div className="parent">',
      '      <span className="first">1</span><span className="second">2</span>',
      '    </div>',
      '  );',
      '}',
      '',
    ].join('\n');
    const filePath = path.join(tmpDir, 'src/Home.tsx');
    await fs.writeFile(filePath, code, 'utf8');

    const writtenCalls: Array<readonly { path: string }[]> = [];
    const res = await service.applyEditBatch(
      tmpDir,
      [
        {
          kind: 'setClassName',
          loc: 'src/Home.tsx:3:5',
          tag: 'div',
          before: 'parent',
          after: 'parent-mod',
        },
        {
          kind: 'setClassName',
          loc: 'src/Home.tsx:4:7',
          tag: 'span',
          before: 'first',
          after: 'first-mod',
        },
        {
          kind: 'setClassName',
          loc: 'src/Home.tsx:4:39',
          tag: 'span',
          before: 'second',
          after: 'second-mod',
        },
      ],
      (files) => {
        writtenCalls.push(files);
      },
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual({ changed: true, files: ['src/Home.tsx'] });
    expect(writtenCalls).toHaveLength(1);
    expect(writtenCalls[0]).toHaveLength(1);

    const onDisk = await fs.readFile(filePath, 'utf8');
    const expected = [
      'export function Home() {',
      '  return (',
      '    <div className="parent-mod">',
      '      <span className="first-mod">1</span><span className="second-mod">2</span>',
      '    </div>',
      '  );',
      '}',
      '',
    ].join('\n');
    expect(onDisk).toBe(expected);
  });

  it('Scenario 2: Batch across 2 files through endpoint and undo byte-exact [R-CB-15, R-HI]', async () => {
    const homeCode =
      'export function Home() {\n  return (\n    <div className="box">\n      <p className="desc">Hi</p>\n    </div>\n  );\n}\n';
    const headerCode =
      'export function Header() {\n  return <header className="top">Nav</header>;\n}\n';
    await fs.writeFile(path.join(tmpDir, 'src/Home.tsx'), homeCode, 'utf8');
    await fs.writeFile(path.join(tmpDir, 'src/Header.tsx'), headerCode, 'utf8');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/source/edits/batch',
      headers: HEADERS,
      payload: {
        edits: [
          {
            kind: 'setClassName',
            loc: 'src/Home.tsx:3:5',
            tag: 'div',
            before: 'box',
            after: 'box-new',
          },
          {
            kind: 'setClassName',
            loc: 'src/Home.tsx:4:7',
            tag: 'p',
            before: 'desc',
            after: 'desc-new',
          },
          {
            kind: 'setClassName',
            loc: 'src/Header.tsx:2:10',
            tag: 'header',
            before: 'top',
            after: 'top-new',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { changed: boolean; files: string[] } }>();
    expect(body.data.changed).toBe(true);
    expect(body.data.files).toEqual(['src/Header.tsx', 'src/Home.tsx']);

    // Check files changed
    const homeAfter = await fs.readFile(path.join(tmpDir, 'src/Home.tsx'), 'utf8');
    const headerAfter = await fs.readFile(path.join(tmpDir, 'src/Header.tsx'), 'utf8');
    expect(homeAfter).toContain('box-new');
    expect(headerAfter).toContain('top-new');

    // Verify history added 1 item
    const historyRes = await app.inject({
      method: 'GET',
      url: '/api/v1/history',
      headers: HEADERS,
    });
    const historyData = historyRes.json<{
      data: { undo?: { key: string; params?: { count?: string } }; undoCount: number };
    }>();
    expect(historyData.data.undoCount).toBe(1);
    expect(historyData.data.undo?.key).toBe('history:batch');
    expect(historyData.data.undo?.params?.count).toBe('3');

    // Undo via history endpoint
    const undoRes = await app.inject({
      method: 'POST',
      url: '/api/v1/history/undo',
      headers: HEADERS,
    });
    expect(undoRes.statusCode).toBe(200);

    // Verify byte-exact restoration
    const homeRestored = await fs.readFile(path.join(tmpDir, 'src/Home.tsx'), 'utf8');
    const headerRestored = await fs.readFile(path.join(tmpDir, 'src/Header.tsx'), 'utf8');
    expect(homeRestored).toBe(homeCode);
    expect(headerRestored).toBe(headerCode);
  });

  it('Scenario 3: Batch with dynamic cn(...) className fails with E023 and writes no files [R-CB-15]', async () => {
    const homeCode =
      'export function Home() {\n  return (\n    <div className="box">\n      <p className={cn(base, "dyn")}>Hi</p>\n    </div>\n  );\n}\n';
    await fs.writeFile(path.join(tmpDir, 'src/Home.tsx'), homeCode, 'utf8');

    const res = await service.applyEditBatch(tmpDir, [
      {
        kind: 'setClassName',
        loc: 'src/Home.tsx:3:5',
        tag: 'div',
        before: 'box',
        after: 'box-new',
      },
      { kind: 'setClassName', loc: 'src/Home.tsx:4:7', tag: 'p', before: 'dyn', after: 'dyn-new' },
    ]);

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('E023');
    expect(res.error.params?.['reason']).toBe('classExpression');

    const onDisk = await fs.readFile(path.join(tmpDir, 'src/Home.tsx'), 'utf8');
    expect(onDisk).toBe(homeCode);
  });

  it('Scenario 4: Batch with stale before fails with E017 and writes no files [R-CB-15]', async () => {
    const code =
      'export function Home() {\n  return <div className="box"><p className="desc">Hi</p></div>;\n}\n';
    await fs.writeFile(path.join(tmpDir, 'src/Home.tsx'), code, 'utf8');

    const res = await service.applyEditBatch(tmpDir, [
      {
        kind: 'setClassName',
        loc: 'src/Home.tsx:2:10',
        tag: 'div',
        before: 'stale-box',
        after: 'box-new',
      },
      {
        kind: 'setClassName',
        loc: 'src/Home.tsx:2:32',
        tag: 'p',
        before: 'desc',
        after: 'desc-new',
      },
    ]);

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('E017');
    expect(res.error.params?.['reason']).toBe('valueChanged');

    const onDisk = await fs.readFile(path.join(tmpDir, 'src/Home.tsx'), 'utf8');
    expect(onDisk).toBe(code);
  });

  it('Scenario 5: Batch where all after === before returns changed false and no history [R-CB-15]', async () => {
    const code =
      'export function Home() {\n  return <div className="box"><p className="desc">Hi</p></div>;\n}\n';
    await fs.writeFile(path.join(tmpDir, 'src/Home.tsx'), code, 'utf8');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/source/edits/batch',
      headers: HEADERS,
      payload: {
        edits: [
          {
            kind: 'setClassName',
            loc: 'src/Home.tsx:2:10',
            tag: 'div',
            before: 'box',
            after: 'box',
          },
          {
            kind: 'setClassName',
            loc: 'src/Home.tsx:2:31',
            tag: 'p',
            before: 'desc',
            after: 'desc',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { changed: boolean; files: string[] } }>();
    expect(body.data.changed).toBe(false);
    expect(body.data.files).toEqual([]);

    const historyRes = await app.inject({
      method: 'GET',
      url: '/api/v1/history',
      headers: HEADERS,
    });
    const historyData = historyRes.json<{ data: { undoCount: number } }>();
    expect(historyData.data.undoCount).toBe(0);
  });

  it('Scenario 6: Duplicate loc returns E016 duplicateLoc; 51 edits returns E016 details [R-CB-15]', async () => {
    const code = 'export function Home() {\n  return <div className="box">Hi</div>;\n}\n';
    await fs.writeFile(path.join(tmpDir, 'src/Home.tsx'), code, 'utf8');

    // Duplicate loc
    const dupRes = await service.applyEditBatch(tmpDir, [
      { kind: 'setClassName', loc: 'src/Home.tsx:2:10', tag: 'div', before: 'box', after: 'box1' },
      { kind: 'setClassName', loc: 'src/Home.tsx:2:10', tag: 'div', before: 'box', after: 'box2' },
    ]);
    expect(dupRes.ok).toBe(false);
    if (!dupRes.ok) {
      expect(dupRes.error.code).toBe('E016');
      expect(dupRes.error.params?.['reason']).toBe('duplicateLoc');
    }

    // 51 edits via HTTP endpoint
    const fiftyOneEdits = Array.from({ length: 51 }, (_, i) => ({
      kind: 'setClassName',
      loc: `src/Home.tsx:${String(i + 1)}:1`,
      tag: 'div',
      after: 'test',
    }));

    const overRes = await app.inject({
      method: 'POST',
      url: '/api/v1/source/edits/batch',
      headers: HEADERS,
      payload: { edits: fiftyOneEdits },
    });
    expect(overRes.statusCode).toBe(400);
    const errBody = overRes.json<{ error: { code: string; details?: unknown[] } }>();
    expect(errBody.error.code).toBe('E016');
    expect(errBody.error.details).toBeDefined();
  });

  it('Scenario 7: Foreign expression warning when inserting across files with variables [R-CB-14]', async () => {
    const destCode =
      'export function About() {\n  return (\n    <main>\n      <h1>About</h1>\n    </main>\n  );\n}\n';
    await fs.writeFile(path.join(tmpDir, 'src/About.tsx'), destCode, 'utf8');

    // 1. Cross file with variable {product.name} -> foreignExpression
    const r1 = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/About.tsx:3:5', tag: 'main' }, where: 'end' },
      jsx: '<p>{product.name}</p>',
      from: { file: 'src/Home.tsx', imports: [] },
    });
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.value.warnings).toContain('foreignExpression');
    }

    // 2. Cross file with literal {'x'} -> no foreignExpression
    const r2 = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/About.tsx:3:5', tag: 'main' }, where: 'end' },
      jsx: "<p>{'x'}</p>",
      from: { file: 'src/Home.tsx', imports: [] },
    });
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.value.warnings ?? []).not.toContain('foreignExpression');
    }

    // 3. Same file (from.file === rel) with variable -> no foreignExpression
    const r3 = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/About.tsx:3:5', tag: 'main' }, where: 'end' },
      jsx: '<p>{product.name}</p>',
      from: { file: 'src/About.tsx', imports: [] },
    });
    expect(r3.ok).toBe(true);
    if (r3.ok) {
      expect(r3.value.warnings ?? []).not.toContain('foreignExpression');
    }
  });
});
