// Tests for chat image store (R-CH-02).
import { mkdtemp, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import { createChatImageStore } from './chat-images.ts';

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function makeFakePng(sizeBytes = 1024): Uint8Array {
  const bytes = new Uint8Array(sizeBytes);
  for (let i = 0; i < PNG_HEADER.length; i += 1) {
    bytes[i] = PNG_HEADER[i] ?? 0;
  }
  return bytes;
}

describe('chat-images store [R-CH-02]', () => {
  let tempDir: string;
  const fs = createNodeFileSystem('linux');

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'rc-chat-images-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('Situation 13: saves real 1 KB PNG and resolves absolute path [R-CH-02]', async () => {
    const store = createChatImageStore({
      fs,
      cacheDir: tempDir,
      now: () => new Date('2026-10-23T00:00:00Z'),
      newId: () => 'img0000001',
    });

    const png = makeFakePng(1024);
    const saveRes = await store.save('proj1', 'png', png);
    expect(saveRes.ok).toBe(true);
    if (!saveRes.ok) return;

    expect(saveRes.value.id).toBe('img0000001');

    const expectedFile = join(tempDir, 'chat-images', 'proj1', 'img0000001.png');
    const exists = await fs.exists(tempDir, 'chat-images/proj1/img0000001.png');
    expect(exists).toBe(true);

    const resolveRes = await store.resolve('proj1', ['img0000001']);
    expect(resolveRes.ok).toBe(true);
    if (!resolveRes.ok) return;

    expect(resolveRes.value).toEqual([expectedFile]);
  });

  it('Situation 14: rejects invalid images, svg, and files over 5 MB without writing [R-CH-02]', async () => {
    const store = createChatImageStore({
      fs,
      cacheDir: tempDir,
      now: () => new Date('2026-10-23T00:00:00Z'),
      newId: () => 'img0000002',
    });

    const textBytes = new TextEncoder().encode('not an image at all');
    const textRes = await store.save('proj1', 'png', textBytes);
    expect(textRes).toEqual({
      ok: false,
      error: { code: 'E016', params: { reason: 'notAnImage' } },
    });

    const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const svgRes = await store.save('proj1', 'png', svgBytes);
    expect(svgRes).toEqual({
      ok: false,
      error: { code: 'E016', params: { reason: 'notAnImage' } },
    });

    const largeBytes = new Uint8Array(5 * 1024 * 1024 + 1);
    const largeRes = await store.save('proj1', 'png', largeBytes);
    expect(largeRes).toEqual({
      ok: false,
      error: { code: 'E016', params: { reason: 'imageTooLarge' } },
    });

    const exists = await fs.exists(tempDir, 'chat-images/proj1/img0000002.png');
    expect(exists).toBe(false);
  });

  it('Situation 15: prunes images older than 7 days when saving a new image [R-CH-02]', async () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const baseTime = new Date('2026-10-23T12:00:00Z').getTime();

    const initialStore = createChatImageStore({
      fs,
      cacheDir: tempDir,
      now: () => new Date(baseTime),
      newId: () => 'imgOld00001',
    });
    await initialStore.save('proj1', 'png', makeFakePng());

    const recentStore = createChatImageStore({
      fs,
      cacheDir: tempDir,
      now: () => new Date(baseTime),
      newId: () => 'imgRecent01',
    });
    await recentStore.save('proj1', 'png', makeFakePng());

    const oldFilePath = join(tempDir, 'chat-images', 'proj1', 'imgOld00001.png');
    const oldTimeSec = (baseTime - 8 * dayMs) / 1000;
    await utimes(oldFilePath, oldTimeSec, oldTimeSec);

    const recentFilePath = join(tempDir, 'chat-images', 'proj1', 'imgRecent01.png');
    const recentTimeSec = (baseTime - 1 * dayMs) / 1000;
    await utimes(recentFilePath, recentTimeSec, recentTimeSec);

    expect(await fs.exists(tempDir, 'chat-images/proj1/imgOld00001.png')).toBe(true);
    expect(await fs.exists(tempDir, 'chat-images/proj1/imgRecent01.png')).toBe(true);

    const newStore = createChatImageStore({
      fs,
      cacheDir: tempDir,
      now: () => new Date(baseTime),
      newId: () => 'imgNew00001',
    });
    await newStore.save('proj1', 'png', makeFakePng());

    expect(await fs.exists(tempDir, 'chat-images/proj1/imgOld00001.png')).toBe(false);
    expect(await fs.exists(tempDir, 'chat-images/proj1/imgRecent01.png')).toBe(true);
    expect(await fs.exists(tempDir, 'chat-images/proj1/imgNew00001.png')).toBe(true);
  });
});
