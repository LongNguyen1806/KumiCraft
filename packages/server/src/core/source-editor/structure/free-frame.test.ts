// Unit tests for Free Frame operations on the Server (Scenarios 5–11, R-FF-10, R-FF-12).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type {
  AttributeLevelEdit,
  BatchEditResult,
  EditResult,
  Result,
  SourceEdit,
  StructureEdit,
  StructureResult,
} from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHistoryService, type HistoryService } from '../../history/history-service.ts';
import { nodeFs } from '../../workspace/test-support.ts';
import { createSourceEditorService, type SourceEditorService } from '../source-editor-service.ts';

describe('Server: Free Frame operations [R-FF-10, R-FF-12]', () => {
  let tmpDir: string;
  let service: SourceEditorService;
  let history: HistoryService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-free-frame-test-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
    history = createHistoryService({ fs: nodeFs });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const writePage = (code: string, name = 'src/Page.tsx') =>
    fs.writeFile(path.join(tmpDir, name), code, 'utf8');
  const readPage = (name = 'src/Page.tsx') => fs.readFile(path.join(tmpDir, name), 'utf8');

  async function applyStructure(edit: StructureEdit): Promise<Result<StructureResult>> {
    return service.applyStructureEdit(tmpDir, edit, (files) => {
      history.push({
        label: { key: edit.kind },
        files: files.map((f) => ({
          path: f.path,
          before: f.before,
          after: f.after,
          beforeHash: f.beforeHash,
          afterHash: f.afterHash,
        })),
      });
    });
  }

  async function applyBatch(
    edits: readonly AttributeLevelEdit[],
  ): Promise<Result<BatchEditResult>> {
    return service.applyEditBatch(tmpDir, edits, (files) => {
      history.push({
        label: { key: 'edit' },
        files: files.map((f) => ({
          path: f.path,
          before: f.before,
          after: f.after,
          beforeHash: f.beforeHash,
          afterHash: f.afterHash,
        })),
      });
    });
  }

  async function applySingleEdit(edit: SourceEdit): Promise<Result<EditResult>> {
    return service.applyEdit(tmpDir, edit, (file) => {
      history.push({
        label: { key: 'edit' },
        files: [
          {
            path: file.path,
            before: file.before,
            after: file.after,
            beforeHash: file.beforeHash,
            afterHash: file.afterHash,
          },
        ],
      });
    });
  }

  it('Scenario 5: inserts Card with placement free (128, 72) into free frame [R-FF-12]', async () => {
    await writePage(
      'export function Page() {\n  return (\n    <div data-rc-free className="relative">\n      <p>Existing</p>\n    </div>\n  );\n}\n',
    );
    const res = await applyStructure({
      kind: 'insert',
      target: {
        kind: 'child',
        parent: { loc: 'src/Page.tsx:3:5', tag: 'div' },
        where: 'end',
      },
      jsx: '<div className="p-4 bg-white">Card</div>',
      placement: { kind: 'free', left: 128, top: 72 },
      tailwindMajor: 4,
    });

    expect(res.ok).toBe(true);
    const content = await readPage();
    expect(content).toContain('className="p-4 bg-white absolute left-32 top-18"');
  });

  it('Scenario 6: moves element out with placement: flow and byte-for-byte undo [R-FF-12]', async () => {
    const original =
      'export function Page() {\n  return (\n    <div>\n      <div data-rc-free className="relative">\n        <p className="absolute left-8 top-8">Item</p>\n      </div>\n      <section className="p-4"></section>\n    </div>\n  );\n}\n';
    await writePage(original);

    const moveRes = await applyStructure({
      kind: 'move',
      elements: [{ loc: 'src/Page.tsx:5:9', tag: 'p' }],
      target: {
        kind: 'child',
        parent: { loc: 'src/Page.tsx:7:7', tag: 'section' },
        where: 'end',
      },
      placement: { kind: 'flow' },
    });
    expect(moveRes.ok).toBe(true);

    const modified = await readPage();
    expect(modified).not.toContain('absolute left-8 top-8');
    expect(modified).toContain('<p>Item</p>');

    const undoRes = await history.undo(tmpDir);
    expect(undoRes.ok).toBe(true);
    expect(await readPage()).toBe(original);
  });

  it('Scenario 7: duplicate in free frame with placement offset [R-FF-12]', async () => {
    await writePage(
      'export function Page() {\n  return (\n    <div data-rc-free className="relative">\n      <div className="absolute left-8 top-8">Box</div>\n    </div>\n  );\n}\n',
    );
    const dupRes = await applyStructure({
      kind: 'duplicate',
      elements: [{ loc: 'src/Page.tsx:4:7', tag: 'div' }],
      placement: { kind: 'free', left: 48, top: 48 },
      tailwindMajor: 4,
    });

    expect(dupRes.ok).toBe(true);
    const content = await readPage();
    expect(content).toContain('className="absolute left-12 top-12"');
  });

  it('Scenario 5b: multi-root insert stacks each root 16 px further, v3 uses arbitrary px [R-FF-12]', async () => {
    await writePage(
      'export function Page() {\n  return (\n    <div data-rc-free className="relative">\n      <p>Existing</p>\n    </div>\n  );\n}\n',
    );
    const res = await applyStructure({
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/Page.tsx:3:5', tag: 'div' }, where: 'end' },
      jsx: '<div className="p-2">A</div>\n<span>B</span>',
      placement: { kind: 'free', left: 32, top: 32 },
      tailwindMajor: 3,
    });

    expect(res.ok).toBe(true);
    const content = await readPage();
    expect(content).toContain('<div className="p-2 absolute left-[32px] top-[32px]">A</div>');
    expect(content).toContain('<span className="absolute left-[48px] top-[48px]">B</span>');
  });

  it('moving an element to where it already is never fails with overlapping edits [R-FF-12, R-SE-24]', async () => {
    const original =
      'export function Page() {\n  return (\n    <div data-rc-free className="relative">\n      <div className="absolute left-0 top-0">\n        <p>Cột 1</p>\n        <p>Cột 2</p>\n      </div>\n    </div>\n  );\n}\n';
    await writePage(original);

    // Last child dropped at the end of its own parent: nothing changes.
    const same = await applyStructure({
      kind: 'move',
      elements: [{ loc: 'src/Page.tsx:6:9', tag: 'p' }],
      target: { kind: 'child', parent: { loc: 'src/Page.tsx:4:7', tag: 'div' }, where: 'end' },
    });
    expect(same.ok).toBe(true);
    expect(await readPage()).toBe(original);

    // Free frame child dragged by its handle inside its own frame: only the coordinates change,
    // the nested lines keep their indentation.
    const placed = await applyStructure({
      kind: 'move',
      elements: [{ loc: 'src/Page.tsx:4:7', tag: 'div' }],
      target: { kind: 'child', parent: { loc: 'src/Page.tsx:3:5', tag: 'div' }, where: 'end' },
      placement: { kind: 'free', left: 8, top: 8 },
      tailwindMajor: 4,
    });
    expect(placed.ok).toBe(true);
    expect(await readPage()).toBe(original.replace('left-0 top-0', 'left-2 top-2'));
    if (placed.ok) expect(placed.value.locs).toEqual(['src/Page.tsx:4:7']);
  });

  it('Scenario 6b: moving two flow elements into a free frame stacks them 16 px apart [R-FF-12]', async () => {
    await writePage(
      'export function Page() {\n  return (\n    <div>\n      <p>One</p>\n      <p>Two</p>\n      <div data-rc-free className="relative"></div>\n    </div>\n  );\n}\n',
    );
    const res = await applyStructure({
      kind: 'move',
      elements: [
        { loc: 'src/Page.tsx:4:7', tag: 'p' },
        { loc: 'src/Page.tsx:5:7', tag: 'p' },
      ],
      target: { kind: 'child', parent: { loc: 'src/Page.tsx:6:7', tag: 'div' }, where: 'end' },
      placement: { kind: 'free', left: 64, top: 8 },
      tailwindMajor: 4,
    });

    expect(res.ok).toBe(true);
    const content = await readPage();
    expect(content).toContain('<p className="absolute left-16 top-2">One</p>');
    expect(content).toContain('<p className="absolute left-20 top-6">Two</p>');
  });

  it('Scenario 8: setFlag on for div, on again (unchanged), off returns byte-for-byte [R-FF-10]', async () => {
    const original =
      'export function Page() {\n  return (\n    <div className="p-4">\n      <p>Hello</p>\n    </div>\n  );\n}\n';
    await writePage(original);

    const onRes = await applySingleEdit({
      kind: 'setFlag',
      loc: 'src/Page.tsx:3:5',
      tag: 'div',
      name: 'data-rc-free',
      on: true,
    });
    expect(onRes.ok).toBe(true);
    const withFlag = await readPage();
    expect(withFlag).toContain('<div data-rc-free className="p-4">');

    const onAgainRes = await applySingleEdit({
      kind: 'setFlag',
      loc: 'src/Page.tsx:3:5',
      tag: 'div',
      name: 'data-rc-free',
      on: true,
    });
    expect(onAgainRes.ok).toBe(true);
    if (onAgainRes.ok) {
      expect(onAgainRes.value.changed).toBe(false);
    }

    const offRes = await applySingleEdit({
      kind: 'setFlag',
      loc: 'src/Page.tsx:3:5',
      tag: 'div',
      name: 'data-rc-free',
      on: false,
    });
    expect(offRes.ok).toBe(true);
    expect(await readPage()).toBe(original);
  });

  it('Scenario 9: batch enables free frame and single undo restores entire file [R-FF-10]', async () => {
    const original =
      'export function Page() {\n  return (\n    <div className="p-2">\n      <p className="text-sm">First</p>\n      <p className="text-sm">Second</p>\n      <p className="text-sm">Third</p>\n    </div>\n  );\n}\n';
    await writePage(original);

    const batchRes = await applyBatch([
      { kind: 'setFlag', loc: 'src/Page.tsx:3:5', tag: 'div', name: 'data-rc-free', on: true },
      {
        kind: 'setClassName',
        loc: 'src/Page.tsx:3:5',
        tag: 'div',
        before: 'p-2',
        after: 'p-2 relative h-[300px]',
      },
      {
        kind: 'setClassName',
        loc: 'src/Page.tsx:4:7',
        tag: 'p',
        before: 'text-sm',
        after: 'text-sm absolute left-0 top-0',
      },
      {
        kind: 'setClassName',
        loc: 'src/Page.tsx:5:7',
        tag: 'p',
        before: 'text-sm',
        after: 'text-sm absolute left-0 top-10',
      },
      {
        kind: 'setClassName',
        loc: 'src/Page.tsx:6:7',
        tag: 'p',
        before: 'text-sm',
        after: 'text-sm absolute left-0 top-20',
      },
    ]);
    expect(batchRes.ok).toBe(true);

    const updated = await readPage();
    expect(updated).toContain('<div data-rc-free className="p-2 relative h-[300px]">');
    expect(updated).toContain('text-sm absolute left-0 top-20');

    const undoRes = await history.undo(tmpDir);
    expect(undoRes.ok).toBe(true);
    expect(await readPage()).toBe(original);
  });

  it('Scenario 10: rejects enabling free frame when child has className expression [R-FF-10]', async () => {
    const original =
      'export function Page() {\n  const dynamicClass = "text-sm";\n  return (\n    <div>\n      <p className={dynamicClass}>Child</p>\n    </div>\n  );\n}\n';
    await writePage(original);

    const batchRes = await applyBatch([
      { kind: 'setFlag', loc: 'src/Page.tsx:4:5', tag: 'div', name: 'data-rc-free', on: true },
      {
        kind: 'setClassName',
        loc: 'src/Page.tsx:5:7',
        tag: 'p',
        after: 'text-sm absolute left-0 top-0',
      },
    ]);
    expect(batchRes.ok).toBe(false);
    if (!batchRes.ok) {
      expect(batchRes.error.code).toBe('E023');
    }
    expect(await readPage()).toBe(original);
  });

  it('Scenario 11: disables free frame and converts child to flow [R-FF-10]', async () => {
    const original =
      'export function Page() {\n  return (\n    <div data-rc-free className="relative h-[300px]">\n      <p className="text-sm absolute left-4 top-8 w-40">Hello</p>\n    </div>\n  );\n}\n';
    await writePage(original);

    const batchRes = await applyBatch([
      { kind: 'setFlag', loc: 'src/Page.tsx:3:5', tag: 'div', name: 'data-rc-free', on: false },
      {
        kind: 'setClassName',
        loc: 'src/Page.tsx:3:5',
        tag: 'div',
        before: 'relative h-[300px]',
        after: 'h-[300px]',
      },
      {
        kind: 'setClassName',
        loc: 'src/Page.tsx:4:7',
        tag: 'p',
        before: 'text-sm absolute left-4 top-8 w-40',
        after: 'text-sm w-40',
      },
    ]);
    expect(batchRes.ok).toBe(true);

    const updated = await readPage();
    expect(updated).toContain('<div className="h-[300px]">');
    expect(updated).toContain('<p className="text-sm w-40">Hello</p>');
    expect(updated).not.toContain('data-rc-free');
    expect(updated).not.toContain('absolute');
  });
});
