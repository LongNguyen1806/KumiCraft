// Unit tests for image utilities [R-DT-13].
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { directWriteFs } from '../workspace/test-support.ts';
import {
  detectImageKind,
  imageBaseName,
  isUnsafeSvg,
  listPublicImages,
  uniqueImagePath,
} from './images.ts';

describe('core/project/images [R-DT-13]', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reactcraft-images-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('#1 detectImageKind identifies images from header bytes [R-DT-13]', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const gif = new TextEncoder().encode('GIF89a...');
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    const svg = new TextEncoder().encode('\uFEFF  <svg width="10" height="10"></svg>');
    const html = new TextEncoder().encode('<html><body>not svg</body></html>');

    expect(detectImageKind(png)).toBe('png');
    expect(detectImageKind(jpg)).toBe('jpg');
    expect(detectImageKind(gif)).toBe('gif');
    expect(detectImageKind(webp)).toBe('webp');
    expect(detectImageKind(svg)).toBe('svg');
    expect(detectImageKind(html)).toBeUndefined();
  });

  it('#2 isUnsafeSvg detects scripts, inline handlers and javascript: urls [R-DT-13]', () => {
    expect(isUnsafeSvg('<svg><script>alert(1)</script></svg>')).toBe(true);
    expect(isUnsafeSvg('<svg onload="x"></svg>')).toBe(true);
    expect(isUnsafeSvg('<svg><a href="javascript:x">click</a></svg>')).toBe(true);
    expect(isUnsafeSvg("<svg><a xlink:href=' JavaScript:x'>click</a></svg>")).toBe(true);
    expect(isUnsafeSvg('<svg><path d="M0"/></svg>')).toBe(false);
  });

  it('#3 imageBaseName normalizes, strips diacritics and enforces constraints [R-DT-13]', () => {
    expect(imageBaseName('Ảnh Đẹp_01.PNG')).toBe('anh-dep-01');
    expect(imageBaseName('..png')).toBe('image');
    expect(imageBaseName('___')).toBe('image');
    expect(imageBaseName('a'.repeat(100))).toBe('a'.repeat(60));
  });

  it('#4 uniqueImagePath finds an available numbered path [R-DT-13]', async () => {
    await fs.mkdir(path.join(tmpDir, 'public/images'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'public/images/logo.png'), 'existing');
    await fs.writeFile(path.join(tmpDir, 'public/images/logo-2.png'), 'existing');

    const result = await uniqueImagePath(directWriteFs, tmpDir, 'logo', 'png');
    expect(result).toBe('public/images/logo-3.png');
  });

  it('#5 listPublicImages returns sorted list of images, ignoring hidden and node_modules [R-DT-13]', async () => {
    await fs.mkdir(path.join(tmpDir, 'public/images'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'public/.hidden'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'public/node_modules'), { recursive: true });

    await fs.writeFile(path.join(tmpDir, 'public/a.png'), 'a');
    await fs.writeFile(path.join(tmpDir, 'public/images/b.svg'), '<svg></svg>');
    await fs.writeFile(path.join(tmpDir, 'public/x.txt'), 'text');
    await fs.writeFile(path.join(tmpDir, 'public/.hidden/c.png'), 'hidden');
    await fs.writeFile(path.join(tmpDir, 'public/node_modules/d.png'), 'node_modules');

    const res = await listPublicImages(directWriteFs, tmpDir);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toEqual(['public/a.png', 'public/images/b.svg']);
    }
  });
});
