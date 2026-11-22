import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { LIBRARY_BLOCKS, renderBlock } from '@kumicraft/content';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHistoryService } from '../../../../kernel/history/history-service.ts';
import { nodeFs } from '../../../../services/workspace/test-support.ts';
import { createSourceEditorService } from '../source-editor-service.ts';

describe('kit-service (Test 6): insert interactive kit + single-step Undo', () => {
  let tmpDir = '';

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(tmpdir(), 'kumicraft-kit-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
  });

  afterEach(async () => {
    if (tmpDir.length > 0) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('creates src/kumicraft/<Name>.tsx once, avoids duplicate imports, never overwrites, and undoes cleanly', async () => {
    const initial = [
      'export function App() {',
      '  return (',
      '    <main>',
      '      <h1>Hello</h1>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n');
    await fs.writeFile(path.join(tmpDir, 'tsconfig.json'), '{}', 'utf8');
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), initial, 'utf8');

    const history = createHistoryService({ fs: nodeFs });
    const editor = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });

    const tabsBlock = LIBRARY_BLOCKS.find((b) => b.id === 'interactive.tabs');
    expect(tabsBlock).toBeDefined();
    if (tabsBlock === undefined) return;
    const rendered = renderBlock(tabsBlock, 'tailwind4', 'en');
    expect(rendered.kit).toEqual({ components: ['Tabs', 'Tab'] });

    const res1 = await editor.applyStructureEdit(
      tmpDir,
      {
        kind: 'insert',
        target: { kind: 'child', parent: { loc: 'src/App.tsx:3:5', tag: 'main' }, where: 'end' },
        jsx: rendered.jsx,
        kit: rendered.kit,
      },
      (files) => {
        for (const f of files) history.recordInternalWrite(f.path, f.afterHash);
        history.push({ label: { key: 'history:insert', params: { name: 'Tabs' } }, files });
      },
    );
    expect(res1.ok).toBe(true);

    const kitAbs = path.join(tmpDir, 'src/kumicraft/Tabs.tsx');
    const kitCode = await fs.readFile(kitAbs, 'utf8');
    expect(kitCode).toContain('export function Tabs');
    expect(kitCode).toContain('export function Tab');

    const after1 = await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8');
    expect(after1).toContain("import { Tabs, Tab } from './kumicraft/Tabs';");
    expect(after1).toContain('<Tabs');

    // Second insert reuses existing Tabs.tsx and avoids duplicate import
    const customMarker = `${kitCode}\n// KEEP ME\n`;
    await fs.writeFile(kitAbs, customMarker, 'utf8');
    const mainLineAfter1 = after1.split('\n').findIndex((l) => l.includes('<main>')) + 1;

    const res2 = await editor.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: {
        kind: 'child',
        parent: { loc: `src/App.tsx:${String(mainLineAfter1)}:5`, tag: 'main' },
        where: 'end',
      },
      jsx: rendered.jsx,
      kit: rendered.kit,
    });
    expect(res2.ok).toBe(true);
    expect(await fs.readFile(kitAbs, 'utf8')).toBe(customMarker);
    const after2 = await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8');
    const importMatches = after2.match(/from '\.\/kumicraft\/Tabs'/g) ?? [];
    expect(importMatches).toHaveLength(1);

    // Undo restores App.tsx + removes Tabs.tsx when done cleanly on fresh insert
    const h2 = createHistoryService({ fs: nodeFs });
    await fs.rm(path.join(tmpDir, 'src/kumicraft'), { recursive: true, force: true });
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), initial, 'utf8');

    const res3 = await editor.applyStructureEdit(
      tmpDir,
      {
        kind: 'insert',
        target: { kind: 'child', parent: { loc: 'src/App.tsx:3:5', tag: 'main' }, where: 'end' },
        jsx: rendered.jsx,
        kit: rendered.kit,
      },
      (files) => {
        for (const f of files) h2.recordInternalWrite(f.path, f.afterHash);
        h2.push({ label: { key: 'history:insert', params: { name: 'Tabs' } }, files });
      },
    );
    expect(res3.ok).toBe(true);
    const undoRes = await h2.undo(tmpDir);
    expect(undoRes.ok).toBe(true);
    expect(await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8')).toBe(initial);
    await expect(fs.stat(kitAbs)).rejects.toThrow();
  });

  it('generates .jsx kit files in JavaScript projects without tsconfig.json', async () => {
    const initial = 'export function App() {\n  return <main><h1>Hi</h1></main>;\n}\n';
    await fs.writeFile(path.join(tmpDir, 'src/App.jsx'), initial, 'utf8');

    const editor = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
    const modal = LIBRARY_BLOCKS.find((b) => b.id === 'interactive.modal');
    expect(modal).toBeDefined();
    if (modal === undefined) return;
    const rendered = renderBlock(modal, 'css', 'en');

    const res = await editor.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/App.jsx:2:10', tag: 'main' }, where: 'end' },
      jsx: rendered.jsx,
      kit: rendered.kit,
    });
    expect(res.ok).toBe(true);
    const modalJsx = await fs.readFile(path.join(tmpDir, 'src/kumicraft/Modal.jsx'), 'utf8');
    expect(modalJsx).toContain('export function Modal');
    expect(modalJsx).not.toContain('export type ');
  });
});
