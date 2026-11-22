// Class edits sent as intents (03 sections 3.3 and 4, ADR-A4): the server works out the classes from
// the steps, writes them through the view editor, records one Undo step, and refuses what it cannot
// do (E017 file changed, E023 screen cannot be split) without touching the file.
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { ClassStep } from '@kumicraft/shared';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHistoryService } from '../../../kernel/history/history-service.ts';
import { createSessionInfoProvider } from '../../../kernel/session.ts';
import { testClassEdits } from '../../../services/edit/class-edits-test-support.ts';
import { nodeFs } from '../../../services/workspace/test-support.ts';
import { jsxFeatures } from '../../../stacks/view/jsx/features.ts';
import { createSourceEditorService } from '../../../stacks/view/jsx/source-editor-service.ts';
import { createHttpApp } from '../create-http-app.ts';

const PORT = 50241;
const TOKEN = 'test-token-class-edits';
const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
  'content-type': 'application/json',
};

const CARD = `export function Card() {
  return (
    <div className="p-4 text-sm">
      <p className="mt-2">Content</p>
    </div>
  );
}
`;
const DIV = 'src/Card.tsx:3:5';
const P = 'src/Card.tsx:4:7';

const base = { breakpoint: 'base' } as const;
const oneScreen = { widths: [1440], activeIndex: 0 };

function padding(token: string, screens = oneScreen, mode: 'all' | 'only' = 'all'): ClassStep {
  return {
    kind: 'set',
    entries: [{ property: 'padding', value: { kind: 'scale', token } }],
    scope: base,
    screens,
    mode,
  };
}

describe('class edits sent as intents [03 section 3.3, ADR-A4]', () => {
  let tmpDir: string;
  let file: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-class-edits-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    file = path.join(tmpDir, 'src/Card.tsx');
    await fs.writeFile(file, CARD, 'utf8');
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
        classEdits: testClassEdits(),
        historyService,
        getProjectRoot: () => tmpDir,
        getViewFeatures: () => jsxFeatures,
        fs: nodeFs,
      },
      historyRoutes: { historyService, getProjectRoot: () => tmpDir },
    });
  });

  afterEach(async () => {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const post = (url: string, payload: object): Promise<LightMyRequestResponse> =>
    app.inject({ method: 'POST', url: `/api/v1/${url}`, headers: HEADERS, payload });

  it('writes the classes the steps make, and one Undo gives the file back byte for byte', async () => {
    const res = await post('source/edits', {
      edit: {
        kind: 'setClasses',
        loc: DIV,
        tag: 'div',
        before: 'p-4 text-sm',
        steps: [padding('6')],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(
      res.json<{ data: { element: { className: unknown } } }>().data.element.className,
    ).toEqual({ kind: 'static', value: 'p-6 text-sm' });
    expect(await fs.readFile(file, 'utf8')).toContain('className="p-6 text-sm"');

    const undo = await post('history/undo', {});
    expect(undo.statusCode).toBe(200);
    expect(await fs.readFile(file, 'utf8')).toBe(CARD);
  });

  it('applies every step in order: Inspector field, raw class text, marker class', async () => {
    const res = await post('source/edits', {
      edit: {
        kind: 'setClasses',
        loc: P,
        tag: 'p',
        before: 'mt-2',
        steps: [
          padding('2'),
          { kind: 'raw', className: 'mt-4 p-2' },
          { kind: 'addClass', name: 'group' },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(await fs.readFile(file, 'utf8')).toContain('<p className="group mt-4 p-2">');
  });

  it('a batch resolves each element, and is one Undo step', async () => {
    const value: ClassStep = {
      kind: 'value',
      property: 'padding',
      scope: base,
      value: { kind: 'scale', token: '8' },
    };
    const res = await post('source/edits/batch', {
      edits: [
        { kind: 'setClasses', loc: DIV, tag: 'div', before: 'p-4 text-sm', steps: [value] },
        { kind: 'setClasses', loc: P, tag: 'p', before: 'mt-2', steps: [value] },
      ],
    });

    expect(res.statusCode).toBe(200);
    const written = await fs.readFile(file, 'utf8');
    expect(written).toContain('className="p-8 text-sm"');
    expect(written).toContain('className="mt-2 p-8"');

    await post('history/undo', {});
    expect(await fs.readFile(file, 'utf8')).toBe(CARD);
  });

  it('a class changed in the file since it was read is refused with E017', async () => {
    const res = await post('source/edits', {
      edit: { kind: 'setClasses', loc: DIV, tag: 'div', before: 'p-2', steps: [padding('6')] },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('E017');
    expect(await fs.readFile(file, 'utf8')).toBe(CARD);
  });

  it('a screen that cannot be set on its own is refused with E023 screenSplit', async () => {
    // 1440 and 1400 px sit between the same breakpoints: no class reaches only one of them.
    const tooClose = { widths: [1440, 1400], activeIndex: 1 };
    const res = await post('source/edits', {
      edit: {
        kind: 'setClasses',
        loc: DIV,
        tag: 'div',
        before: 'p-4 text-sm',
        steps: [padding('6', tooClose, 'only')],
      },
    });

    expect(res.json<{ error: { code: string; params?: unknown } }>().error).toMatchObject({
      code: 'E023',
      params: { reason: 'screenSplit' },
    });
    expect(await fs.readFile(file, 'utf8')).toBe(CARD);
  });

  it('a step the contract does not know is refused with E016', async () => {
    const res = await post('source/edits', {
      edit: { kind: 'setClasses', loc: DIV, tag: 'div', before: '', steps: [{ kind: 'css' }] },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('E016');
  });
});
