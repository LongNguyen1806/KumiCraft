// Unit tests for History Service file creation/deletion support [R-HI-11].
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../workspace/test-support.ts';
import { computeBytesSha256, computeSha256, createHistoryService } from './history-service.ts';

describe('M-HI: History Service file create/delete [R-HI-11]', () => {
  let tmpDir: string;
  let nowMs = 1000;
  const fakeNow = () => nowMs;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kumicraft-history-files-'));
    nowMs = 1000;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('handles created file: Undo deletes file and Redo recreates it byte-for-byte [R-HI-11]', async () => {
    const f = 'src/NewPage.tsx';
    const full = path.join(tmpDir, f);
    await fs.mkdir(path.dirname(full), { recursive: true });

    const content = 'export function NewPage() { return <div>New</div>; }';
    await fs.writeFile(full, content, 'utf8');

    const history = createHistoryService({ fs: nodeFs, now: fakeNow });
    history.push({
      label: { key: 'history:insert' },
      files: [
        {
          path: f,
          after: content,
          afterHash: computeSha256(content),
        },
      ],
    });

    // Undo -> file must be deleted
    const u = await history.undo(tmpDir);
    expect(u.ok).toBe(true);
    expect(await nodeFs.exists(tmpDir, f)).toBe(false);

    // Redo -> file must be recreated with exact bytes
    const r = await history.redo(tmpDir);
    expect(r.ok).toBe(true);
    expect(await nodeFs.exists(tmpDir, f)).toBe(true);
    expect(await fs.readFile(full, 'utf8')).toBe(content);
  });

  it('handles deleted file: Undo restores file and Redo deletes it byte-for-byte [R-HI-11]', async () => {
    const f = 'src/OldPage.tsx';
    const full = path.join(tmpDir, f);
    await fs.mkdir(path.dirname(full), { recursive: true });

    const content = 'export function OldPage() { return <div>Old</div>; }';

    const history = createHistoryService({ fs: nodeFs, now: fakeNow });
    history.push({
      label: { key: 'history:remove' },
      files: [
        {
          path: f,
          before: content,
          beforeHash: computeSha256(content),
        },
      ],
    });

    // Undo -> file restored
    const u = await history.undo(tmpDir);
    expect(u.ok).toBe(true);
    expect(await fs.readFile(full, 'utf8')).toBe(content);

    // Redo -> file removed
    const r = await history.redo(tmpDir);
    expect(r.ok).toBe(true);
    expect(await nodeFs.exists(tmpDir, f)).toBe(false);
  });

  it('#8 rejects undoing a file creation step when the file was modified externally [R-HI-11]', async () => {
    const f = 'src/Created.tsx';
    const full = path.join(tmpDir, f);
    await fs.mkdir(path.dirname(full), { recursive: true });

    const originalContent = 'original created content';
    await fs.writeFile(full, originalContent, 'utf8');

    const history = createHistoryService({ fs: nodeFs, now: fakeNow });
    history.push({
      label: { key: 'history:insert' },
      files: [
        {
          path: f,
          after: originalContent,
          afterHash: computeSha256(originalContent),
        },
      ],
    });

    // Modify file externally
    const modifiedContent = 'externally modified content';
    await fs.writeFile(full, modifiedContent, 'utf8');

    // Undo must be rejected with E017 and the file must NOT be deleted
    const res = await history.undo(tmpDir);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('E017');
    }
    expect(await nodeFs.exists(tmpDir, f)).toBe(true);
    expect(await fs.readFile(full, 'utf8')).toBe(modifiedContent);
  });

  it('handles binary created file: Undo deletes and Redo recreates byte-for-byte [R-HI-11]', async () => {
    const f = 'public/images/logo.png';
    const full = path.join(tmpDir, f);
    await fs.mkdir(path.dirname(full), { recursive: true });

    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    await fs.writeFile(full, bytes);
    const b64 = Buffer.from(bytes).toString('base64');

    const history = createHistoryService({ fs: nodeFs, now: fakeNow });
    history.push({
      label: { key: 'history:insertImage', params: { name: 'logo.png' } },
      files: [
        {
          path: f,
          after: b64,
          afterHash: computeBytesSha256(bytes),
          encoding: 'base64',
        },
      ],
    });

    const u = await history.undo(tmpDir);
    expect(u.ok).toBe(true);
    expect(await nodeFs.exists(tmpDir, f)).toBe(false);

    const r = await history.redo(tmpDir);
    expect(r.ok).toBe(true);
    expect(await nodeFs.exists(tmpDir, f)).toBe(true);
    const restored = await fs.readFile(full);
    expect(Buffer.compare(restored, Buffer.from(bytes))).toBe(0);
  });

  it('#11 blocks undo when a base64 encoded binary file was modified externally [R-HI-11]', async () => {
    const f = 'public/images/test.png';
    const full = path.join(tmpDir, f);
    await fs.mkdir(path.dirname(full), { recursive: true });

    const originalBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);
    await fs.writeFile(full, originalBytes);
    const b64 = Buffer.from(originalBytes).toString('base64');

    const history = createHistoryService({ fs: nodeFs, now: fakeNow });
    history.push({
      label: { key: 'history:insertImage', params: { name: 'test.png' } },
      files: [
        {
          path: f,
          after: b64,
          afterHash: computeBytesSha256(originalBytes),
          encoding: 'base64',
        },
      ],
    });

    // Modify file externally
    await fs.writeFile(full, new Uint8Array([1, 2, 3, 4]));

    const res = await history.undo(tmpDir);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('E017');
    }
    expect(await nodeFs.exists(tmpDir, f)).toBe(true);
    const current = await fs.readFile(full);
    expect(Buffer.compare(current, Buffer.from([1, 2, 3, 4]))).toBe(0);
  });
});
