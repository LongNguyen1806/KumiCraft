// Test 2: setDataArray (TK-32) and dataContext reading.
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNodeFileSystem } from '../../../../adapters/fs/node-file-system.ts';
import { createSourceEditorService } from '../source-editor-service.ts';

describe('setDataArray [TK-32, Test 2]', () => {
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
