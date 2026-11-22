// Unit tests for insertImage structure edit [R-DT-13, R-DT-14, R-HI-11].
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { InsertImageEdit } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHistoryService } from '../../../../kernel/history/history-service.ts';
import type { FileSystemPort } from '../../../../ports/file-system-port.ts';
import { directWriteFs, nodeFs } from '../../../../services/workspace/test-support.ts';
import { createSourceEditorService, type WrittenFile } from '../source-editor-service.ts';
import { buildImgJsx } from './insert-image.ts';

const SAMPLE_PAGE = `export function App() {
  return (
    <section>
      <h1>Title</h1>
    </section>
  );
}
`;

describe('core/source-editor/structure/insert-image [R-DT-13, R-DT-14, R-HI-11]', () => {
  let tmpDir: string;
  let service: ReturnType<typeof createSourceEditorService>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-insert-img-'));
    service = createSourceEditorService({ fs: directWriteFs });

    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), SAMPLE_PAGE, 'utf8');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('#6 insertImage upload PNG with diacritics and quotes in alt [R-DT-13]', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const b64 = Buffer.from(pngBytes).toString('base64');

    const edit: InsertImageEdit = {
      kind: 'insertImage',
      target: { kind: 'child', parent: { loc: 'src/App.tsx:3:5', tag: 'section' }, where: 'end' },
      image: { kind: 'upload', name: 'Logo Mới.png', dataBase64: b64 },
      alt: 'Logo "mới"',
      className: 'w-full h-auto',
    };

    let writtenCalls: WrittenFile[] = [];
    const res = await service.applyStructureEdit(tmpDir, edit, (files) => {
      writtenCalls = [...files];
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.changed).toBe(true);
      expect(res.value.files).toContain('src/App.tsx');
      expect(res.value.locs.length).toBeGreaterThan(0);
    }

    const imgFile = path.join(tmpDir, 'public/images/logo-moi.png');
    const diskBytes = await fs.readFile(imgFile);
    expect(Buffer.compare(diskBytes, Buffer.from(pngBytes))).toBe(0);

    const code = await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8');
    expect(code).toContain(
      '<img src="/images/logo-moi.png" alt="Logo &quot;mới&quot;" className="w-full h-auto" />',
    );
    expect(writtenCalls.some((f) => f.path === 'public/images/logo-moi.png')).toBe(true);
  });

  it('#7 insertImage upload followed by Undo and Redo [R-DT-14, R-HI-11]', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 4, 5, 6]);
    const b64 = Buffer.from(pngBytes).toString('base64');
    const history = createHistoryService({ fs: directWriteFs });

    const edit: InsertImageEdit = {
      kind: 'insertImage',
      target: { kind: 'child', parent: { loc: 'src/App.tsx:3:5', tag: 'section' }, where: 'end' },
      image: { kind: 'upload', name: 'Logo Mới.png', dataBase64: b64 },
      alt: 'Logo "mới"',
      className: 'w-full h-auto',
    };

    const res = await service.applyStructureEdit(tmpDir, edit, (files) => {
      history.push({
        label: { key: 'history:insertImage', params: { name: 'Logo Mới.png' } },
        files,
      });
    });
    expect(res.ok).toBe(true);

    const imgPath = 'public/images/logo-moi.png';
    expect(await nodeFs.exists(tmpDir, imgPath)).toBe(true);

    // Undo -> page restored, image deleted
    const undoRes = await history.undo(tmpDir);
    expect(undoRes.ok).toBe(true);
    expect(await nodeFs.exists(tmpDir, imgPath)).toBe(false);
    const codeAfterUndo = await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8');
    expect(codeAfterUndo).toBe(SAMPLE_PAGE);

    // Redo -> image recreated byte-for-byte, page has <img>
    const redoRes = await history.redo(tmpDir);
    expect(redoRes.ok).toBe(true);
    expect(await nodeFs.exists(tmpDir, imgPath)).toBe(true);
    const restoredBytes = await fs.readFile(path.join(tmpDir, imgPath));
    expect(Buffer.compare(restoredBytes, Buffer.from(pngBytes))).toBe(0);
    const codeAfterRedo = await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8');
    expect(codeAfterRedo).toContain('<img src="/images/logo-moi.png"');
  });

  it('#8 rejects oversized upload, invalid magic bytes, and unsafe SVG [R-DT-13]', async () => {
    // 5 MB + 1 byte
    const tooLargeBytes = new Uint8Array(5 * 1024 * 1024 + 1);
    const tooLargeB64 = Buffer.from(tooLargeBytes).toString('base64');
    const res1 = await service.applyStructureEdit(tmpDir, {
      kind: 'insertImage',
      target: { kind: 'child', parent: { loc: 'src/App.tsx:3:5', tag: 'section' }, where: 'end' },
      image: { kind: 'upload', name: 'big.png', dataBase64: tooLargeB64 },
      alt: 'Big',
      className: '',
    });
    expect(res1).toEqual({ ok: false, error: { code: 'E016', params: { reason: 'tooLarge' } } });

    // Unsupported magic bytes
    const randomBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const randomB64 = Buffer.from(randomBytes).toString('base64');
    const res2 = await service.applyStructureEdit(tmpDir, {
      kind: 'insertImage',
      target: { kind: 'child', parent: { loc: 'src/App.tsx:3:5', tag: 'section' }, where: 'end' },
      image: { kind: 'upload', name: 'corrupt.png', dataBase64: randomB64 },
      alt: 'Corrupt',
      className: '',
    });
    expect(res2).toEqual({
      ok: false,
      error: { code: 'E016', params: { reason: 'unsupportedImage' } },
    });

    // Unsafe SVG with onload
    const unsafeSvg = '<svg onload="alert(1)"></svg>';
    const unsafeB64 = Buffer.from(unsafeSvg, 'utf8').toString('base64');
    const res3 = await service.applyStructureEdit(tmpDir, {
      kind: 'insertImage',
      target: { kind: 'child', parent: { loc: 'src/App.tsx:3:5', tag: 'section' }, where: 'end' },
      image: { kind: 'upload', name: 'evil.svg', dataBase64: unsafeB64 },
      alt: 'Evil',
      className: '',
    });
    expect(res3).toEqual({ ok: false, error: { code: 'E016', params: { reason: 'unsafeSvg' } } });

    expect(await nodeFs.exists(tmpDir, 'public/images/big.png')).toBe(false);
    expect(await nodeFs.exists(tmpDir, 'public/images/corrupt.png')).toBe(false);
    expect(await nodeFs.exists(tmpDir, 'public/images/evil.svg')).toBe(false);
  });

  it('#9 handles existing image: valid, missing, or escaping public root [R-DT-13]', async () => {
    await fs.mkdir(path.join(tmpDir, 'public/images'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'public/images/b.svg'), '<svg><path d="M0"/></svg>');

    // Valid existing image
    const res1 = await service.applyStructureEdit(tmpDir, {
      kind: 'insertImage',
      target: { kind: 'child', parent: { loc: 'src/App.tsx:3:5', tag: 'section' }, where: 'end' },
      image: { kind: 'existing', src: '/images/b.svg' },
      alt: 'Icon',
      className: '',
    });
    expect(res1.ok).toBe(true);
    const code = await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8');
    expect(code).toContain('<img src="/images/b.svg" alt="Icon" />');

    // Missing image
    const res2 = await service.applyStructureEdit(tmpDir, {
      kind: 'insertImage',
      target: { kind: 'child', parent: { loc: 'src/App.tsx:3:5', tag: 'section' }, where: 'end' },
      image: { kind: 'existing', src: '/images/khong-co.png' },
      alt: 'Missing',
      className: '',
    });
    expect(res2).toEqual({
      ok: false,
      error: { code: 'E016', params: { reason: 'imageNotFound' } },
    });

    // Escaping public path with ..
    const res3 = await service.applyStructureEdit(tmpDir, {
      kind: 'insertImage',
      target: { kind: 'child', parent: { loc: 'src/App.tsx:3:5', tag: 'section' }, where: 'end' },
      image: { kind: 'existing', src: '/../secret.png' },
      alt: 'Secret',
      className: '',
    });
    expect(res3.ok).toBe(false);
    if (!res3.ok) {
      expect(res3.error.code === 'E012' || res3.error.code === 'E016').toBe(true);
    }
  });

  it('#10 cleans up image file when code write fails [R-DT-14]', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 8]);
    const b64 = Buffer.from(pngBytes).toString('base64');

    // Mock fs that fails writing App.tsx
    const failingFs: FileSystemPort = {
      ...directWriteFs,
      writeTextAtomic: async (root, filePath, content, options) => {
        if (filePath.endsWith('App.tsx')) {
          return { ok: false, error: { code: 'E003', params: { file: filePath } } };
        }
        return directWriteFs.writeTextAtomic(root, filePath, content, options);
      },
    };

    const failService = createSourceEditorService({ fs: failingFs });
    let written = false;

    const res = await failService.applyStructureEdit(
      tmpDir,
      {
        kind: 'insertImage',
        target: {
          kind: 'child',
          parent: { loc: 'src/App.tsx:3:5', tag: 'section' },
          where: 'end',
        },
        image: { kind: 'upload', name: 'fail.png', dataBase64: b64 },
        alt: 'Fail',
        className: '',
      },
      () => {
        written = true;
      },
    );

    expect(res.ok).toBe(false);
    expect(written).toBe(false);
    expect(await nodeFs.exists(tmpDir, 'public/images/fail.png')).toBe(false);
  });
});

describe('buildImgJsx escaping [R-DT-13]', () => {
  it('no value can close its attribute and inject code into the file', () => {
    expect(buildImgJsx('/images/a.png', 'A "b" <c>', 'w-full" onClick={() => alert(1)} x="')).toBe(
      '<img src="/images/a.png" alt="A &quot;b&quot; &lt;c&gt;" ' +
        'className="w-full&quot; onClick={() =&gt; alert(1)} x=&quot;" />',
    );
  });
});
