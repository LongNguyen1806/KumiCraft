// History Service unit tests (SPEC-04 section 7 R-HI-01 to R-HI-08).
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { err } from '@reactcraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createEventBus } from '../ports/event-bus-port.ts';
import { nodeFs } from '../workspace/test-support.ts';
import { createHistoryService } from './history-service.ts';

function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

describe('M-HI: History Service', () => {
  let tmpDir: string;
  let currentTime = 10000;
  const fakeNow = () => currentTime;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-hi-test-'));
    currentTime = 10000;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('handles 3 edits → Undo ×3 → Redo ×3 preserving exact byte content [R-HI-01, R-HI-06]', async () => {
    const filePath = 'src/App.tsx';
    const fullPath = path.join(tmpDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    const c0 = 'Initial Content';
    const c1 = 'First Edit';
    const c2 = 'Second Edit';
    const c3 = 'Third Edit';

    await fs.writeFile(fullPath, c3, 'utf8');

    const history = createHistoryService({ fs: nodeFs, now: fakeNow });

    history.push({
      label: { key: 'history:setClassName', params: { tag: 'div' } },
      files: [
        {
          path: filePath,
          before: c0,
          after: c1,
          beforeHash: computeSha256(c0),
          afterHash: computeSha256(c1),
        },
      ],
    });
    history.push({
      label: { key: 'history:setText', params: { tag: 'p' } },
      files: [
        {
          path: filePath,
          before: c1,
          after: c2,
          beforeHash: computeSha256(c1),
          afterHash: computeSha256(c2),
        },
      ],
    });
    history.push({
      label: { key: 'history:setAttribute', params: { tag: 'button' } },
      files: [
        {
          path: filePath,
          before: c2,
          after: c3,
          beforeHash: computeSha256(c2),
          afterHash: computeSha256(c3),
        },
      ],
    });

    expect(history.getState().undoCount).toBe(3);
    expect(history.getState().redoCount).toBe(0);

    // Undo 1: c3 -> c2
    const u1 = await history.undo(tmpDir);
    expect(u1.ok).toBe(true);
    expect(await fs.readFile(fullPath, 'utf8')).toBe(c2);
    expect(history.getState().undoCount).toBe(2);
    expect(history.getState().redoCount).toBe(1);

    // Undo 2: c2 -> c1
    const u2 = await history.undo(tmpDir);
    expect(u2.ok).toBe(true);
    expect(await fs.readFile(fullPath, 'utf8')).toBe(c1);

    // Undo 3: c1 -> c0
    const u3 = await history.undo(tmpDir);
    expect(u3.ok).toBe(true);
    expect(await fs.readFile(fullPath, 'utf8')).toBe(c0);
    expect(history.getState().undoCount).toBe(0);
    expect(history.getState().redoCount).toBe(3);

    // Redo 1: c0 -> c1
    const r1 = await history.redo(tmpDir);
    expect(r1.ok).toBe(true);
    expect(await fs.readFile(fullPath, 'utf8')).toBe(c1);

    // Redo 2: c1 -> c2
    const r2 = await history.redo(tmpDir);
    expect(r2.ok).toBe(true);
    expect(await fs.readFile(fullPath, 'utf8')).toBe(c2);

    // Redo 3: c2 -> c3
    const r3 = await history.redo(tmpDir);
    expect(r3.ok).toBe(true);
    expect(await fs.readFile(fullPath, 'utf8')).toBe(c3);
    expect(history.getState().undoCount).toBe(3);
    expect(history.getState().redoCount).toBe(0);
  });

  it('coalesces edits with same key within 500 ms [R-HI-02]', () => {
    const history = createHistoryService({ fs: nodeFs, now: fakeNow });
    const filePath = 'src/App.tsx';

    // 10 edits spaced by 100 ms
    for (let i = 0; i < 10; i++) {
      currentTime += 100;
      history.push({
        label: { key: 'history:setClassName', params: { tag: 'div' } },
        coalesceKey: 'cls:div:1',
        files: [
          {
            path: filePath,
            before: `cls-${String(i)}`,
            after: `cls-${String(i + 1)}`,
            beforeHash: computeSha256(`cls-${String(i)}`),
            afterHash: computeSha256(`cls-${String(i + 1)}`),
          },
        ],
      });
    }

    expect(history.getState().undoCount).toBe(1);

    // Next edit after 600 ms (> 500 ms window)
    currentTime += 600;
    history.push({
      label: { key: 'history:setClassName', params: { tag: 'div' } },
      coalesceKey: 'cls:div:1',
      files: [
        {
          path: filePath,
          before: 'cls-10',
          after: 'cls-11',
          beforeHash: computeSha256('cls-10'),
          afterHash: computeSha256('cls-11'),
        },
      ],
    });

    expect(history.getState().undoCount).toBe(2);
  });

  it('does not coalesce if an undo happened in between [R-HI-02]', async () => {
    const filePath = 'src/App.tsx';
    const fullPath = path.join(tmpDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, 'b', 'utf8');

    const history = createHistoryService({ fs: nodeFs, now: fakeNow });

    currentTime = 1000;
    history.push({
      label: { key: 'history:setText' },
      coalesceKey: 'k1',
      files: [
        {
          path: filePath,
          before: 'a',
          after: 'b',
          beforeHash: computeSha256('a'),
          afterHash: computeSha256('b'),
        },
      ],
    });

    // Undo occurs
    await history.undo(tmpDir);

    // Next push within 100 ms with same key
    currentTime = 1050;
    history.push({
      label: { key: 'history:setText' },
      coalesceKey: 'k1',
      files: [
        {
          path: filePath,
          before: 'a',
          after: 'c',
          beforeHash: computeSha256('a'),
          afterHash: computeSha256('c'),
        },
      ],
    });

    expect(history.getState().undoCount).toBe(1);
    expect(history.getState().redoCount).toBe(0);
  });

  it('clears redo stack on new edit [R-HI-03]', async () => {
    const filePath = 'src/App.tsx';
    const fullPath = path.join(tmpDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, 'b', 'utf8');

    const history = createHistoryService({ fs: nodeFs, now: fakeNow });

    history.push({
      label: { key: 'history:setText' },
      files: [
        {
          path: filePath,
          before: 'a',
          after: 'b',
          beforeHash: computeSha256('a'),
          afterHash: computeSha256('b'),
        },
      ],
    });

    await history.undo(tmpDir);
    expect(history.getState().redoCount).toBe(1);

    // New edit
    history.push({
      label: { key: 'history:setText' },
      files: [
        {
          path: filePath,
          before: 'a',
          after: 'x',
          beforeHash: computeSha256('a'),
          afterHash: computeSha256('x'),
        },
      ],
    });

    expect(history.getState().redoCount).toBe(0);
    expect(history.getState().undoCount).toBe(1);
  });

  it('discards steps of file A when file A is edited externally [R-HI-04, R-HI-05]', () => {
    const bus = createEventBus();
    let historyChangedFired = false;
    let filesChangedFired = false;

    bus.subscribe((e) => {
      if (e.type === 'history.changed') historyChangedFired = true;
      if (e.type === 'project.filesChanged') filesChangedFired = true;
    });

    const history = createHistoryService({ fs: nodeFs, eventBus: bus, now: fakeNow });

    history.push({
      label: { key: 'history:setText' },
      files: [
        {
          path: 'src/A.tsx',
          before: 'a1',
          after: 'a2',
          beforeHash: computeSha256('a1'),
          afterHash: computeSha256('a2'),
        },
      ],
    });
    history.push({
      label: { key: 'history:setText' },
      files: [
        {
          path: 'src/B.tsx',
          before: 'b1',
          after: 'b2',
          beforeHash: computeSha256('b1'),
          afterHash: computeSha256('b2'),
        },
      ],
    });

    expect(history.getState().undoCount).toBe(2);
    expect(historyChangedFired).toBe(true);
    expect(filesChangedFired).toBe(false);

    historyChangedFired = false;

    // External change to A.tsx
    const discarded = history.handleExternalChange('src/A.tsx', 'external-hash');
    expect(discarded).toBe(true);
    expect(historyChangedFired).toBe(true);
    expect(filesChangedFired).toBe(true);

    // B.tsx remains in history, A.tsx dropped
    expect(history.getState().undoCount).toBe(1);
  });

  it('ignores external change event when hash matches ReactCraft last write [R-HI-05]', () => {
    const bus = createEventBus();
    let filesChangedFired = false;
    bus.subscribe((e) => {
      if (e.type === 'project.filesChanged') filesChangedFired = true;
    });

    const history = createHistoryService({ fs: nodeFs, eventBus: bus, now: fakeNow });
    const content = 'rc-write';
    const hash = computeSha256(content);

    history.push({
      label: { key: 'history:setText' },
      files: [
        {
          path: 'src/A.tsx',
          before: 'old',
          after: content,
          beforeHash: computeSha256('old'),
          afterHash: hash,
        },
      ],
    });

    const discarded = history.handleExternalChange('src/A.tsx', hash);
    expect(discarded).toBe(false);
    expect(filesChangedFired).toBe(false);
    expect(history.getState().undoCount).toBe(1);
  });

  it('detects file change on Undo when watcher has not reported yet [R-HI-04, R-HI-07]', async () => {
    const filePath = 'src/App.tsx';
    const fullPath = path.join(tmpDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // File was modified externally to 'external'
    await fs.writeFile(fullPath, 'external', 'utf8');

    const history = createHistoryService({ fs: nodeFs, now: fakeNow });
    history.push({
      label: { key: 'history:setText' },
      files: [
        {
          path: filePath,
          before: 'a',
          after: 'b',
          beforeHash: computeSha256('a'),
          afterHash: computeSha256('b'),
        },
      ],
    });

    const undoRes = await history.undo(tmpDir);
    expect(undoRes.ok).toBe(false);
    if (!undoRes.ok) {
      expect(undoRes.error.code).toBe('E017');
      expect(undoRes.error.params?.['reason']).toBe('fileChanged');
    }

    // File was not modified
    expect(await fs.readFile(fullPath, 'utf8')).toBe('external');
    // History was cleared for that file
    expect(history.getState().undoCount).toBe(0);
  });

  it('limits history to 200 items [R-HI-07]', () => {
    const history = createHistoryService({ fs: nodeFs, now: fakeNow });
    for (let i = 0; i < 210; i++) {
      currentTime += 1000;
      history.push({
        label: { key: 'history:setText' },
        files: [
          {
            path: `src/File${String(i)}.tsx`,
            before: 'a',
            after: 'b',
            beforeHash: computeSha256('a'),
            afterHash: computeSha256('b'),
          },
        ],
      });
    }

    expect(history.getState().undoCount).toBe(200);
  });

  it('returns E015 when undo or redo is empty', async () => {
    const history = createHistoryService({ fs: nodeFs, now: fakeNow });
    const u = await history.undo(tmpDir);
    expect(u.ok).toBe(false);
    if (!u.ok) expect(u.error.code).toBe('E015');

    const r = await history.redo(tmpDir);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('E015');
  });

  it('rolls back already written files if multi-file undo fails [R-HI-06]', async () => {
    const f1 = 'src/F1.tsx';
    const f2 = 'src/F2.tsx';
    const full1 = path.join(tmpDir, f1);
    const full2 = path.join(tmpDir, f2);
    await fs.mkdir(path.dirname(full1), { recursive: true });

    await fs.writeFile(full1, 'after1', 'utf8');
    await fs.writeFile(full2, 'after2', 'utf8');

    // Simulate failing FileSystemPort for F2
    const failingFs = {
      ...nodeFs,
      writeTextAtomic: async (root: string, relPath: string, content: string) => {
        if (relPath === f2) {
          return err({ code: 'E011', params: { path: f2, operation: 'write' } });
        }
        return nodeFs.writeTextAtomic(root, relPath, content);
      },
    };

    const history = createHistoryService({ fs: failingFs, now: fakeNow });
    history.push({
      label: { key: 'history:setClassName' },
      files: [
        {
          path: f1,
          before: 'before1',
          after: 'after1',
          beforeHash: computeSha256('before1'),
          afterHash: computeSha256('after1'),
        },
        {
          path: f2,
          before: 'before2',
          after: 'after2',
          beforeHash: computeSha256('before2'),
          afterHash: computeSha256('after2'),
        },
      ],
    });

    const res = await history.undo(tmpDir);
    expect(res.ok).toBe(false);

    // F1 must be rolled back to 'after1'
    expect(await fs.readFile(full1, 'utf8')).toBe('after1');
  });
});
