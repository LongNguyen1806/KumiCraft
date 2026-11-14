// Test 1 & Test 2: repeatElement (TK-31), single Undo, setDataArray (TK-32), and dataContext reading.
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNodeFileSystem } from '../../../adapters/fs/node-file-system.ts';
import { createHistoryService } from '../../history/history-service.ts';
import { createSourceEditorService } from '../source-editor-service.ts';

describe('repeatElement & setDataArray [TK-31, TK-32, Test 1, Test 2]', () => {
  let tmpRoot = '';
  const nodeFs = createNodeFileSystem('linux');

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(tmpdir(), 'kumicraft-data-ops-'));
    await fs.mkdir(path.join(tmpRoot, 'src'), { recursive: true });
  });

  afterEach(async () => {
    if (tmpRoot.length > 0) {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it('Test 1: repeatElement creates data file + .map loop + import, single Undo restores both, and rejects nested .map/complex/return root', async () => {
    const appPath = path.join(tmpRoot, 'src/App.tsx');
    const original = [
      'export function App() {',
      '  return (',
      '    <section>',
      '      <article className="card">',
      '        <h3>Tiêu đề thẻ</h3>',
      '        <p>Mô tả ngắn gọn</p>',
      '        <img src="/hero.png" alt="Ảnh" />',
      '        <a href="/xem">Xem thêm</a>',
      '      </article>',
      '    </section>',
      '  );',
      '}',
      '',
    ].join('\n');
    await fs.writeFile(appPath, original, 'utf8');

    const editor = createSourceEditorService({ fs: nodeFs });
    const history = createHistoryService({ fs: nodeFs });

    const res = await editor.applyStructureEdit(
      tmpRoot,
      { kind: 'repeatElement', loc: 'src/App.tsx:4:7', tag: 'article', name: 'cards', count: 3 },
      (files) => {
        history.push({
          label: { key: 'history:repeatElement', params: { tag: 'article' } },
          files,
        });
      },
    );
    expect(res).toEqual(expect.objectContaining({ ok: true }));
    if (!res.ok) return;

    const updatedApp = await fs.readFile(appPath, 'utf8');
    expect(updatedApp).toContain("import { cards } from './kumicraft/data/cards.data';");
    expect(updatedApp).toContain('{cards.map((item) => (');
    expect(updatedApp).toContain('key={item.id}');
    expect(updatedApp).toContain('{item.title}');
    expect(updatedApp).toContain('{item.description}');
    expect(updatedApp).toContain('src={item.image}');
    expect(updatedApp).toContain('href={item.link}');

    const dataFile = path.join(tmpRoot, 'src/kumicraft/data/cards.data.ts');
    const dataText = await fs.readFile(dataFile, 'utf8');
    expect(dataText).toContain("title: 'Tiêu đề thẻ'");
    expect(dataText).toContain("title: 'Tiêu đề thẻ 2'");
    expect(dataText).toContain("title: 'Tiêu đề thẻ 3'");

    // Reject calling repeatElement again on an element already inside .map (must fail -> reverse-check target!)
    const nestedLoc = res.value.locs[0] ?? 'src/App.tsx:6:1';
    const nestedRes = await editor.applyStructureEdit(tmpRoot, {
      kind: 'repeatElement',
      loc: nestedLoc,
      tag: 'article',
    });
    expect(nestedRes.ok).toBe(false);
    if (!nestedRes.ok) {
      expect(nestedRes.error.code).toBe('E023');
      expect(nestedRes.error.params).toEqual({ reason: 'alreadyInLoop' });
    }

    // Single Undo deletes created data file and restores original App.tsx
    const undoRes = await history.undo(tmpRoot);
    expect(undoRes.ok).toBe(true);
    expect(await fs.readFile(appPath, 'utf8')).toBe(original);
    await expect(fs.access(dataFile)).rejects.toThrow();

    // Reject return root element (<section> at line 3)
    const rootRes = await editor.applyStructureEdit(tmpRoot, {
      kind: 'repeatElement',
      loc: 'src/App.tsx:3:5',
      tag: 'section',
    });
    expect(rootRes.ok).toBe(false);

    // Reject element containing dynamic expression
    const dynPath = path.join(tmpRoot, 'src/Dyn.tsx');
    await fs.writeFile(
      dynPath,
      'export function Dyn({ label }: { label: string }) {\n  return <div><button>{label}</button></div>;\n}\n',
      'utf8',
    );
    const dynRes = await editor.applyStructureEdit(tmpRoot, {
      kind: 'repeatElement',
      loc: 'src/Dyn.tsx:2:15',
      tag: 'button',
    });
    expect(dynRes.ok).toBe(false);
  });

  it('Test 2: readDataContextForNode & setDataArray preserve leading comments and reject invalid array shapes', async () => {
    await fs.mkdir(path.join(tmpRoot, 'src/kumicraft/data'), { recursive: true });
    const dataPath = path.join(tmpRoot, 'src/kumicraft/data/items.data.ts');
    await fs.writeFile(
      dataPath,
      "// Leading comment kept intact\nexport const items = [\n  { id: '1', title: 'One', active: true },\n  { id: '2', title: 'Two', active: false },\n];\n",
      'utf8',
    );
    const pagePath = path.join(tmpRoot, 'src/Page.tsx');
    await fs.writeFile(
      pagePath,
      "import { items } from './kumicraft/data/items.data';\nexport function Page() {\n  return <div>{items.map((item) => (<span key={item.id}>{item.title}</span>))}</div>;\n}\n",
      'utf8',
    );

    const editor = createSourceEditorService({ fs: nodeFs });
    const elRes = await editor.getElement(tmpRoot, 'src/Page.tsx:3:37');
    expect(elRes.ok).toBe(true);
    if (!elRes.ok) return;
    expect(elRes.value.inLoop).toBe(true);
    expect(elRes.value.dataContext?.exportName).toBe('items');
    expect(elRes.value.dataContext?.rows).toHaveLength(2);
    expect(elRes.value.dataContext?.columns).toEqual(['id', 'title', 'active']);

    const setRes = await editor.applyStructureEdit(tmpRoot, {
      kind: 'setDataArray',
      file: 'src/kumicraft/data/items.data.ts',
      exportName: 'items',
      rows: [
        { id: '1', title: 'Updated', active: true },
        { id: '3', title: 'Added', count: 42 },
      ],
    });
    expect(setRes.ok).toBe(true);
    const afterData = await fs.readFile(dataPath, 'utf8');
    expect(afterData.startsWith('// Leading comment kept intact')).toBe(true);
    expect(afterData).toContain("title: 'Updated'");
    expect(afterData).toContain('count: 42');

    // Invalid shape (function call / non-primitive) -> readonly in dataContext and rejected by setDataArray
    const badPath = path.join(tmpRoot, 'src/kumicraft/data/bad.data.ts');
    await fs.writeFile(
      badPath,
      "export const badItems = [{ id: '1', meta: { nested: true } }];\n",
      'utf8',
    );
    const badSet = await editor.applyStructureEdit(tmpRoot, {
      kind: 'setDataArray',
      file: 'src/kumicraft/data/bad.data.ts',
      exportName: 'badItems',
      rows: [{ id: '1', title: 'ok' }],
    });
    expect(badSet.ok).toBe(false);
  });
});
