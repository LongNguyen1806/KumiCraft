// A kit insert is all or nothing (QA K9.7-3): if a kit file cannot be written after the page was
// edited, the page goes back as it was, so it never imports a file that does not exist.
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { err, LIBRARY_BLOCKS, renderBlock } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { FileSystemPort } from '../../../../ports/file-system-port.ts';
import { nodeFs } from '../../../../services/workspace/test-support.ts';
import { createSourceEditorService } from '../source-editor-service.ts';

const PAGE = [
  'export function App() {',
  '  return (',
  '    <main>',
  '      <h1>Hello</h1>',
  '    </main>',
  '  );',
  '}',
  '',
].join('\n');

/** The real file system, except that writing any kit file fails. */
const failingKitFs: FileSystemPort = {
  ...nodeFs,
  writeTextAtomic: (root, rel, text) =>
    rel.split('\\').join('/').includes('kumicraft/')
      ? Promise.resolve(err({ code: 'E017', params: { reason: 'diskFull' } }))
      : nodeFs.writeTextAtomic(root, rel, text),
};

describe('kit insert rollback [K9.7-3 QA]', () => {
  let tmpDir = '';

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(tmpdir(), 'kumicraft-kit-rb-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'tsconfig.json'), '{}', 'utf8');
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), PAGE, 'utf8');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('puts the page back when the kit file cannot be written', async () => {
    const block = LIBRARY_BLOCKS.find((b) => b.id === 'interactive.tabs');
    if (block === undefined) throw new Error('Missing interactive.tabs');
    const rendered = renderBlock(block, 'tailwind4', 'en');
    const editor = createSourceEditorService({ fs: failingKitFs }, { sourceDir: 'src' });

    const res = await editor.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/App.tsx:3:5', tag: 'main' }, where: 'end' },
      jsx: rendered.jsx,
      kit: rendered.kit,
    });

    expect(res.ok).toBe(false);
    expect(await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8')).toBe(PAGE);
    await expect(fs.access(path.join(tmpDir, 'src/kumicraft/Tabs.tsx'))).rejects.toThrow();
  });
});
