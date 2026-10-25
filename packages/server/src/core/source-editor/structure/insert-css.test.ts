// Integration tests for inserting Library blocks with CSS rules (R-ST-12, R-ST-15).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { type InsertEdit, LIBRARY_BLOCKS, renderBlock } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHistoryService } from '../../history/history-service.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { directWriteFs, nodeFs } from '../../workspace/test-support.ts';
import { createSourceEditorService, type WrittenFile } from '../source-editor-service.ts';

const PAGE_WITH_CSS = `import './App.css';

export function App() {
  return (
    <section>
      <h1>Title</h1>
    </section>
  );
}
`;

const INITIAL_CSS = `.existing {
  color: #111827;
}
`;

const PAGE_WITHOUT_CSS = `export function App() {
  return (
    <section>
      <h1>Title</h1>
    </section>
  );
}
`;

describe('core/source-editor/structure/insert-css [R-ST-12, R-ST-15]', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kc-insert-css-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('9. [R-ST-12, R-ST-15] inserts CSS block into JSX and appends rules to imported CSS file as one history step with byte-for-byte Undo', async () => {
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), PAGE_WITH_CSS, 'utf8');
    await fs.writeFile(path.join(tmpDir, 'src/App.css'), INITIAL_CSS, 'utf8');

    const service = createSourceEditorService({ fs: directWriteFs });
    const history = createHistoryService({ fs: directWriteFs });
    const rowBlock = LIBRARY_BLOCKS.find((b) => b.id === 'layout.row');
    expect(rowBlock).toBeDefined();
    if (rowBlock === undefined) return;

    const rendered = renderBlock(rowBlock, 'css', 'vi');
    const edit: InsertEdit = {
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/App.tsx:5:5', tag: 'section' }, where: 'end' },
      jsx: rendered.jsx,
      css: { rules: rendered.rules },
    };

    const writtenBatches: (readonly WrittenFile[])[] = [];
    const res = await service.applyStructureEdit(tmpDir, edit, (files) => {
      writtenBatches.push(files);
      history.push({ label: { key: 'history:insert', params: { tag: 'div', count: '1' } }, files });
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.files).toEqual(['src/App.tsx', 'src/App.css']);
    expect(writtenBatches).toHaveLength(1);
    expect(history.getState().undoCount).toBe(1);

    const nextJsx = await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8');
    const nextCss = await fs.readFile(path.join(tmpDir, 'src/App.css'), 'utf8');
    expect(nextJsx).toContain('className="kc-row"');
    expect(nextJsx).toContain('className="kc-row-cell"');
    expect(nextCss.startsWith(INITIAL_CSS.trimEnd())).toBe(true);
    expect(nextCss).toContain('.kc-row {');
    expect(nextCss).toContain('.kc-row-cell {');
    expect(nextCss).toContain('padding: 16px;');

    const undoRes = await history.undo(tmpDir);
    expect(undoRes.ok).toBe(true);
    expect(history.getState().undoCount).toBe(0);
    expect(await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8')).toBe(PAGE_WITH_CSS);
    expect(await fs.readFile(path.join(tmpDir, 'src/App.css'), 'utf8')).toBe(INITIAL_CSS);
  });

  it('10. [R-ST-12] second insert of the same block adds JSX without changing CSS when rules already exist', async () => {
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), PAGE_WITH_CSS, 'utf8');
    await fs.writeFile(path.join(tmpDir, 'src/App.css'), INITIAL_CSS, 'utf8');

    const service = createSourceEditorService({ fs: directWriteFs });
    const rowBlock = LIBRARY_BLOCKS.find((b) => b.id === 'layout.row');
    expect(rowBlock).toBeDefined();
    if (rowBlock === undefined) return;
    const rendered = renderBlock(rowBlock, 'css', 'vi');

    const edit: InsertEdit = {
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/App.tsx:5:5', tag: 'section' }, where: 'end' },
      jsx: rendered.jsx,
      css: { rules: rendered.rules },
    };

    const first = await service.applyStructureEdit(tmpDir, edit);
    expect(first.ok).toBe(true);
    const cssAfterFirst = await fs.readFile(path.join(tmpDir, 'src/App.css'), 'utf8');

    const second = await service.applyStructureEdit(tmpDir, edit);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.files).toEqual(['src/App.tsx']);

    const cssAfterSecond = await fs.readFile(path.join(tmpDir, 'src/App.css'), 'utf8');
    expect(cssAfterSecond).toBe(cssAfterFirst);
    const jsxAfterSecond = await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8');
    expect(jsxAfterSecond.match(/className="kc-row"/g)).toHaveLength(2);
  });

  it('11. [R-ST-12] page without CSS import creates <File>.css and adds import in the same history entry', async () => {
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), PAGE_WITHOUT_CSS, 'utf8');

    const service = createSourceEditorService({ fs: directWriteFs });
    const history = createHistoryService({ fs: directWriteFs });
    const rowBlock = LIBRARY_BLOCKS.find((b) => b.id === 'layout.row');
    expect(rowBlock).toBeDefined();
    if (rowBlock === undefined) return;
    const rendered = renderBlock(rowBlock, 'css', 'vi');

    let recordedFiles: readonly WrittenFile[] = [];
    const res = await service.applyStructureEdit(
      tmpDir,
      {
        kind: 'insert',
        target: { kind: 'child', parent: { loc: 'src/App.tsx:3:5', tag: 'section' }, where: 'end' },
        jsx: rendered.jsx,
        css: { rules: rendered.rules },
      },
      (files) => {
        recordedFiles = files;
        history.push({
          label: { key: 'history:insert', params: { tag: 'div', count: '1' } },
          files,
        });
      },
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.files).toEqual(['src/App.tsx', 'src/App.css']);
    expect(recordedFiles).toHaveLength(2);
    expect(recordedFiles.find((f) => f.path === 'src/App.css')?.before).toBeUndefined();
    expect(history.getState().undoCount).toBe(1);

    const nextJsx = await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8');
    expect(nextJsx).toContain("import './App.css';");
    expect(nextJsx).toContain('className="kc-row"');
    const createdCss = await fs.readFile(path.join(tmpDir, 'src/App.css'), 'utf8');
    expect(createdCss).toContain('.kc-row-cell {');

    const undoRes = await history.undo(tmpDir);
    expect(undoRes.ok).toBe(true);
    expect(history.getState().undoCount).toBe(0);
    expect(await nodeFs.exists(tmpDir, 'src/App.css')).toBe(false);
    expect(await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8')).toBe(PAGE_WITHOUT_CSS);
  });

  it('12. [R-ST-12] cssModules primary system appends rules to first globalCss file instead of .module.css', async () => {
    const modulePage = `import styles from './App.module.css';\n\n${PAGE_WITHOUT_CSS}`;
    const moduleCss = `.title {\n  color: blue;\n}\n`;
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), modulePage, 'utf8');
    await fs.writeFile(path.join(tmpDir, 'src/App.module.css'), moduleCss, 'utf8');
    await fs.writeFile(path.join(tmpDir, 'src/index.css'), INITIAL_CSS, 'utf8');
    await fs.writeFile(path.join(tmpDir, 'src/main.tsx'), "import './index.css';\n", 'utf8');

    const service = createSourceEditorService({
      fs: directWriteFs,
      styling: {
        systems: [{ id: 'cssModules' }],
        primary: 'cssModules',
        editable: false,
        globalCss: ['src/index.css'],
      },
    });
    const rowBlock = LIBRARY_BLOCKS.find((b) => b.id === 'layout.row');
    expect(rowBlock).toBeDefined();
    if (rowBlock === undefined) return;
    const rendered = renderBlock(rowBlock, 'cssModules', 'vi');

    const res = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/App.tsx:5:5', tag: 'section' }, where: 'end' },
      jsx: rendered.jsx,
      css: { rules: rendered.rules },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.files).toEqual(['src/App.tsx', 'src/index.css']);
    expect(await fs.readFile(path.join(tmpDir, 'src/App.module.css'), 'utf8')).toBe(moduleCss);
    expect(await nodeFs.exists(tmpDir, 'src/App.css')).toBe(false);
    expect(await fs.readFile(path.join(tmpDir, 'src/index.css'), 'utf8')).toContain('.kc-row {');
  });

  it('13. [R-ST-12] rejects css.rules with selector not matching /^\\.kc-/ or value containing ; with E016 and leaves all files unchanged', async () => {
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), PAGE_WITH_CSS, 'utf8');
    await fs.writeFile(path.join(tmpDir, 'src/App.css'), INITIAL_CSS, 'utf8');
    const service = createSourceEditorService({ fs: directWriteFs });

    const badSelectorRes = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/App.tsx:5:5', tag: 'section' }, where: 'end' },
      jsx: '<div className="bad">Hi</div>',
      css: { rules: [{ selector: '.bad', declarations: { padding: '8px' } }] },
    });
    expect(badSelectorRes.ok).toBe(false);
    if (!badSelectorRes.ok) expect(badSelectorRes.error.code).toBe('E016');

    const badValueRes = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/App.tsx:5:5', tag: 'section' }, where: 'end' },
      jsx: '<div className="kc-row">Hi</div>',
      css: { rules: [{ selector: '.kc-row', declarations: { padding: '8px; color: red' } }] },
    });
    expect(badValueRes.ok).toBe(false);
    if (!badValueRes.ok) expect(badValueRes.error.code).toBe('E016');

    expect(await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8')).toBe(PAGE_WITH_CSS);
    expect(await fs.readFile(path.join(tmpDir, 'src/App.css'), 'utf8')).toBe(INITIAL_CSS);
  });

  it('writes a new CSS file before the import of it, so Vite never sees an import of a missing file [R-ST-12]', async () => {
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), PAGE_WITHOUT_CSS, 'utf8');
    const order: string[] = [];
    const recordingFs: FileSystemPort = {
      ...directWriteFs,
      writeTextAtomic: (root, rel, content) => {
        order.push(rel);
        return directWriteFs.writeTextAtomic(root, rel, content);
      },
    };
    const rowBlock = LIBRARY_BLOCKS.find((b) => b.id === 'layout.row');
    if (rowBlock === undefined) throw new Error('layout.row block missing');
    const rendered = renderBlock(rowBlock, 'css', 'en');
    const res = await createSourceEditorService({ fs: recordingFs }).applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/App.tsx:3:5', tag: 'section' }, where: 'end' },
      jsx: rendered.jsx,
      css: { rules: rendered.rules },
    });
    expect(res.ok).toBe(true);
    // The block's JSX, then App.css, then the import that needs App.css to exist.
    expect(order).toEqual(['src/App.tsx', 'src/App.css', 'src/App.tsx']);
    expect(await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8')).toContain(
      "import './App.css';",
    );
  });

  it('puts the JSX back when the CSS step fails, so no edit is left without history [R-ST-15]', async () => {
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), PAGE_WITH_CSS, 'utf8');
    const broken = '.existing { color: red;\n';
    await fs.writeFile(path.join(tmpDir, 'src/App.css'), broken, 'utf8');
    const rowBlock = LIBRARY_BLOCKS.find((b) => b.id === 'layout.row');
    if (rowBlock === undefined) throw new Error('layout.row block missing');
    const rendered = renderBlock(rowBlock, 'css', 'en');
    const batches: (readonly WrittenFile[])[] = [];
    const res = await createSourceEditorService({ fs: directWriteFs }).applyStructureEdit(
      tmpDir,
      {
        kind: 'insert',
        target: { kind: 'child', parent: { loc: 'src/App.tsx:5:5', tag: 'section' }, where: 'end' },
        jsx: rendered.jsx,
        css: { rules: rendered.rules },
      },
      (files) => {
        batches.push(files);
      },
    );
    expect(res.ok).toBe(false);
    expect(batches).toHaveLength(0);
    expect(await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8')).toBe(PAGE_WITH_CSS);
    expect(await fs.readFile(path.join(tmpDir, 'src/App.css'), 'utf8')).toBe(broken);
  });
});
