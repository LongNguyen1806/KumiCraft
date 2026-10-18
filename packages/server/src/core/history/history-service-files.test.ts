// Unit tests for History Service file creation/deletion support [R-HI-11].
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../workspace/test-support.ts';
import { computeSha256, createHistoryService } from './history-service.ts';

describe('M-HI: History Service file create/delete [R-HI-11]', () => {
  let tmpDir: string;
  let nowMs = 1000;
  const fakeNow = () => nowMs;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reactcraft-history-files-'));
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
});
