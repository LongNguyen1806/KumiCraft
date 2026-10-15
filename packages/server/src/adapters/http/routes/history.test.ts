// History HTTP routes contract test (SPEC-03 section 5.6).
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHistoryService } from '../../../core/history/history-service.ts';
import { createSessionInfoProvider } from '../../../core/shared/session.ts';
import { nodeFs } from '../../../core/workspace/test-support.ts';
import { createHttpApp } from '../create-http-app.ts';

const PORT = 50241;
const TOKEN = 'test-token-history';
const HEADERS = {
  authorization: `Bearer ${TOKEN}`,
  host: `127.0.0.1:${String(PORT)}`,
  'content-type': 'application/json',
};

function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

describe('History HTTP routes [SPEC-03 section 5.6]', () => {
  let tmpDir: string;
  let app: FastifyInstance;
  let activeRoot: string | undefined;
  let historyService: ReturnType<typeof createHistoryService>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-hist-route-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    activeRoot = tmpDir;

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

  it('GET /api/v1/history returns current HistoryState', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/history',
      headers: HEADERS,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { undoCount: number; redoCount: number } }>();
    expect(body.data.undoCount).toBe(0);
    expect(body.data.redoCount).toBe(0);
  });

  it('POST /api/v1/history/undo returns 404 E015 when history is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/history/undo',
      headers: HEADERS,
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('E015');
  });

  it('POST /api/v1/history/undo and /redo revert and reapply changes', async () => {
    const filePath = 'src/Page.tsx';
    const fullPath = path.join(tmpDir, filePath);
    const beforeContent = 'original text';
    const afterContent = 'modified text';

    await fs.writeFile(fullPath, afterContent, 'utf8');

    historyService.push({
      label: { key: 'history:setText', params: { tag: 'p' } },
      files: [
        {
          path: filePath,
          before: beforeContent,
          after: afterContent,
          beforeHash: computeSha256(beforeContent),
          afterHash: computeSha256(afterContent),
        },
      ],
    });

    // Undo
    const undoRes = await app.inject({
      method: 'POST',
      url: '/api/v1/history/undo',
      headers: HEADERS,
    });

    expect(undoRes.statusCode).toBe(200);
    const undoBody = undoRes.json<{
      data: { files: string[]; state: { undoCount: number; redoCount: number } };
    }>();
    expect(undoBody.data.files).toEqual([filePath]);
    expect(undoBody.data.state.undoCount).toBe(0);
    expect(undoBody.data.state.redoCount).toBe(1);
    expect(await fs.readFile(fullPath, 'utf8')).toBe(beforeContent);

    // Redo
    const redoRes = await app.inject({
      method: 'POST',
      url: '/api/v1/history/redo',
      headers: HEADERS,
    });

    expect(redoRes.statusCode).toBe(200);
    const redoBody = redoRes.json<{
      data: { files: string[]; state: { undoCount: number; redoCount: number } };
    }>();
    expect(redoBody.data.files).toEqual([filePath]);
    expect(redoBody.data.state.undoCount).toBe(1);
    expect(redoBody.data.state.redoCount).toBe(0);
    expect(await fs.readFile(fullPath, 'utf8')).toBe(afterContent);
  });

  it('returns 404 E021 when project is not open', async () => {
    activeRoot = undefined;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/history',
      headers: HEADERS,
    });

    expect(res.statusCode).toBe(409);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('E021');
  });
});
