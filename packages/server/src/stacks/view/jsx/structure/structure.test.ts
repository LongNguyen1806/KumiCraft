import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  asAstNode,
  type AstNode,
  getJsxTagName,
  parseJsxAst,
} from '../../../../lib/ast-helpers.ts';
import { nodeFs } from '../../../../services/workspace/test-support.ts';
import { createSourceEditorService, type WrittenFile } from '../source-editor-service.ts';
import { checkElementStructureGuard } from './structure-guard.ts';
import { listTsxFiles, REPO_ROOT } from './test-support.ts';

function collectValidJsxElements(
  ast: AstNode,
  rel: string,
): Array<{ readonly loc: string; readonly tag: string }> {
  const valid: Array<{ readonly loc: string; readonly tag: string }> = [];
  function walk(node: AstNode): void {
    if (node.type === 'JSXElement') {
      const opening = asAstNode(node['openingElement']);
      const tag = opening ? getJsxTagName(opening) : undefined;
      const startPos = opening?.loc?.start;
      if (tag && startPos) {
        const loc = `${rel}:${String(startPos.line)}:${String(startPos.column + 1)}`;
        if (checkElementStructureGuard(ast, node, loc).ok) valid.push({ loc, tag });
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
      const list = Array.isArray(value) ? value : [value];
      for (const item of list) {
        const child = asAstNode(item);
        if (child) walk(child);
      }
    }
  }
  walk(ast);
  return valid;
}

describe('M-SE: Structural JSX Edits (insert, remove, duplicate)', () => {
  let tmpDir: string;
  let service: ReturnType<typeof createSourceEditorService>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-struct-test-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const writePage = (code: string, name = 'src/Page.tsx') =>
    fs.writeFile(path.join(tmpDir, name), code, 'utf8');
  const readPage = (name = 'src/Page.tsx') => fs.readFile(path.join(tmpDir, name), 'utf8');

  it('#1 inserts sibling before and after, preserves indentation and returns new locs [R-SE-22]', async () => {
    await writePage(
      'export function Page() {\n  return (\n    <div>\n      <p>Middle</p>\n    </div>\n  );\n}\n',
    );
    const beforeRes = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'sibling', ref: { loc: 'src/Page.tsx:4:7', tag: 'p' }, where: 'before' },
      jsx: '<span>First</span>',
    });
    expect(beforeRes.ok && beforeRes.value.locs).toEqual(['src/Page.tsx:4:7']);
    const elBefore = await service.getElement(tmpDir, 'src/Page.tsx:4:7');
    expect(elBefore.ok && elBefore.value.tag).toBe('span');

    const afterRes = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'sibling', ref: { loc: 'src/Page.tsx:5:7', tag: 'p' }, where: 'after' },
      jsx: '<em>Last</em>',
    });
    expect(afterRes.ok && afterRes.value.locs).toEqual(['src/Page.tsx:6:7']);
    const elAfter = await service.getElement(tmpDir, 'src/Page.tsx:6:7');
    expect(elAfter.ok && elAfter.value.tag).toBe('em');
    expect(await readPage()).toBe(
      'export function Page() {\n  return (\n    <div>\n      <span>First</span>\n      <p>Middle</p>\n      <em>Last</em>\n    </div>\n  );\n}\n',
    );
  });

  it('#2 inserts child at start and end of non-empty parent [R-SE-22]', async () => {
    await writePage(
      'export function Page() {\n  return (\n    <section>\n      <p>Body</p>\n    </section>\n  );\n}\n',
    );
    const parent = { loc: 'src/Page.tsx:3:5', tag: 'section' };
    expect(
      (
        await service.applyStructureEdit(tmpDir, {
          kind: 'insert',
          target: { kind: 'child', parent, where: 'start' },
          jsx: '<h2>Title</h2>',
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await service.applyStructureEdit(tmpDir, {
          kind: 'insert',
          target: { kind: 'child', parent, where: 'end' },
          jsx: '<footer>End</footer>',
        })
      ).ok,
    ).toBe(true);
    expect(await readPage()).toBe(
      'export function Page() {\n  return (\n    <section>\n      <h2>Title</h2>\n      <p>Body</p>\n      <footer>End</footer>\n    </section>\n  );\n}\n',
    );
  });

  it('#3 inserts child into empty paired parent and self-closing parent [R-SE-22]', async () => {
    await writePage(
      'export function Page() {\n  return (\n    <main>\n      <div></div>\n      <section />\n    </main>\n  );\n}\n',
    );
    expect(
      (
        await service.applyStructureEdit(tmpDir, {
          kind: 'insert',
          target: { kind: 'child', parent: { loc: 'src/Page.tsx:4:7', tag: 'div' }, where: 'end' },
          jsx: '<span>Inside paired</span>',
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await service.applyStructureEdit(tmpDir, {
          kind: 'insert',
          target: {
            kind: 'child',
            parent: { loc: 'src/Page.tsx:7:7', tag: 'section' },
            where: 'start',
          },
          jsx: '<p>Inside self-closing</p>',
        })
      ).ok,
    ).toBe(true);
    expect(await readPage()).toBe(
      'export function Page() {\n  return (\n    <main>\n      <div>\n        <span>Inside paired</span>\n      </div>\n      <section>\n        <p>Inside self-closing</p>\n      </section>\n    </main>\n  );\n}\n',
    );
  });

  it('#4 rejects invalid inserted jsx with E016 reason notJsx [R-SE-22]', async () => {
    await writePage('export function Page() {\n  return <div><p>Hi</p></div>;\n}\n');
    for (const invalidJsx of ['<div>', 'hello', '{foo}']) {
      const res = await service.applyStructureEdit(tmpDir, {
        kind: 'insert',
        target: { kind: 'sibling', ref: { loc: 'src/Page.tsx:2:15', tag: 'p' }, where: 'after' },
        jsx: invalidJsx,
      });
      expect(res).toEqual({ ok: false, error: { code: 'E016', params: { reason: 'notJsx' } } });
    }
  });

  it('#5 removes single-line, multi-line, and inline elements cleanly [R-SE-25]', async () => {
    await writePage(
      'export function Page() {\n  return (\n    <div>\n      <span>One line</span>\n      <section>\n        <p>Multi line</p>\n      </section>\n      <p>Keep <b>bold</b> text</p>\n    </div>\n  );\n}\n',
    );
    const res = await service.applyStructureEdit(tmpDir, {
      kind: 'remove',
      elements: [
        { loc: 'src/Page.tsx:4:7', tag: 'span' },
        { loc: 'src/Page.tsx:5:7', tag: 'section' },
        { loc: 'src/Page.tsx:8:15', tag: 'b' },
      ],
    });
    expect(res).toEqual({ ok: true, value: { changed: true, files: ['src/Page.tsx'], locs: [] } });
    expect(await readPage()).toBe(
      'export function Page() {\n  return (\n    <div>\n      <p>Keep  text</p>\n    </div>\n  );\n}\n',
    );
  });

  it('#6 removes parent and child selected together without overlap error [R-SE-25]', async () => {
    await writePage(
      'export function Page() {\n  return (\n    <div>\n      <section>\n        <p>Inner</p>\n      </section>\n      <footer>Stay</footer>\n    </div>\n  );\n}\n',
    );
    const res = await service.applyStructureEdit(tmpDir, {
      kind: 'remove',
      elements: [
        { loc: 'src/Page.tsx:5:9', tag: 'p' },
        { loc: 'src/Page.tsx:4:7', tag: 'section' },
      ],
    });
    expect(res.ok).toBe(true);
    expect(await readPage()).toBe(
      'export function Page() {\n  return (\n    <div>\n      <footer>Stay</footer>\n    </div>\n  );\n}\n',
    );
  });

  it('#7 duplicates 1 element and 2 elements in the same file with exact locs [R-SE-26]', async () => {
    await writePage(
      'export function Page() {\n  return (\n    <div>\n      <p className="a">First</p>\n      <span className="b">\n        Second\n      </span>\n    </div>\n  );\n}\n',
    );
    const res1 = await service.applyStructureEdit(tmpDir, {
      kind: 'duplicate',
      elements: [{ loc: 'src/Page.tsx:4:7', tag: 'p' }],
    });
    expect(res1.ok && res1.value.locs).toEqual(['src/Page.tsx:5:7']);

    const res2 = await service.applyStructureEdit(tmpDir, {
      kind: 'duplicate',
      elements: [
        { loc: 'src/Page.tsx:4:7', tag: 'p' },
        { loc: 'src/Page.tsx:6:7', tag: 'span' },
      ],
    });
    expect(res2.ok && res2.value.locs).toEqual(['src/Page.tsx:5:7', 'src/Page.tsx:10:7']);
    for (const loc of ['src/Page.tsx:5:7', 'src/Page.tsx:10:7']) {
      expect((await service.getElement(tmpDir, loc)).ok).toBe(true);
    }
  });

  it('#8 rejects rootElement with E023 reason rootElement [R-SE-21]', async () => {
    await writePage(
      'export function Page() {\n  return (\n    <div>\n      <p>Child</p>\n    </div>\n  );\n}\n',
    );
    const ref = { loc: 'src/Page.tsx:3:5', tag: 'div' };
    const expected = {
      ok: false,
      error: { code: 'E023', params: { loc: ref.loc, reason: 'rootElement' } },
    };
    expect(await service.applyStructureEdit(tmpDir, { kind: 'remove', elements: [ref] })).toEqual(
      expected,
    );
    expect(
      await service.applyStructureEdit(tmpDir, { kind: 'duplicate', elements: [ref] }),
    ).toEqual(expected);
    expect(
      await service.applyStructureEdit(tmpDir, {
        kind: 'insert',
        target: { kind: 'sibling', ref, where: 'before' },
        jsx: '<span />',
      }),
    ).toEqual(expected);
  });

  it('#9 rejects loopRoot with E023 reason loopRoot [R-SE-21]', async () => {
    await writePage(
      'export function Page({ items }: { items: string[] }) {\n  return (\n    <ul>\n      {items.map((item) => (\n        <li key={item}>{item}</li>\n      ))}\n    </ul>\n  );\n}\n',
    );
    const ref = { loc: 'src/Page.tsx:5:9', tag: 'li' };
    const expected = {
      ok: false,
      error: { code: 'E023', params: { loc: ref.loc, reason: 'loopRoot' } },
    };
    expect(await service.applyStructureEdit(tmpDir, { kind: 'remove', elements: [ref] })).toEqual(
      expected,
    );
    expect(
      await service.applyStructureEdit(tmpDir, { kind: 'duplicate', elements: [ref] }),
    ).toEqual(expected);
    expect(
      await service.applyStructureEdit(tmpDir, {
        kind: 'insert',
        target: { kind: 'sibling', ref, where: 'after' },
        jsx: '<li>Other</li>',
      }),
    ).toEqual(expected);
  });

  it('#10 rejects expressionChild with E023 reason expressionChild [R-SE-21]', async () => {
    await writePage(
      'export function Page({ show }: { show: boolean }) {\n  return (\n    <div>\n      {show && <span>Conditional</span>}\n    </div>\n  );\n}\n',
    );
    const res = await service.applyStructureEdit(tmpDir, {
      kind: 'remove',
      elements: [{ loc: 'src/Page.tsx:4:16', tag: 'span' }],
    });
    expect(res).toEqual({
      ok: false,
      error: { code: 'E023', params: { loc: 'src/Page.tsx:4:16', reason: 'expressionChild' } },
    });
  });

  it('#11 rejects componentSlot when inserting child into element with {children} [R-SE-21]', async () => {
    await writePage(
      'export function Card({ children }: { children: React.ReactNode }) {\n  return (\n    <div className="card">\n      {children}\n    </div>\n  );\n}\n',
      'src/Card.tsx',
    );
    const res = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/Card.tsx:3:5', tag: 'div' }, where: 'end' },
      jsx: '<p>Slot</p>',
    });
    expect(res).toEqual({
      ok: false,
      error: { code: 'E023', params: { loc: 'src/Card.tsx:3:5', reason: 'componentSlot' } },
    });
  });

  it('#12 rejects tag mismatch and invalid loc with E017 reason moved [R-SE-29]', async () => {
    await writePage(
      'export function Page() {\n  return (\n    <div>\n      <p>Hello</p>\n    </div>\n  );\n}\n',
    );
    expect(
      await service.applyStructureEdit(tmpDir, {
        kind: 'remove',
        elements: [{ loc: 'src/Page.tsx:4:7', tag: 'span' }],
      }),
    ).toEqual({
      ok: false,
      error: { code: 'E017', params: { loc: 'src/Page.tsx:4:7', reason: 'moved' } },
    });
    expect(
      await service.applyStructureEdit(tmpDir, {
        kind: 'remove',
        elements: [{ loc: 'src/Page.tsx:20:5', tag: 'p' }],
      }),
    ).toEqual({
      ok: false,
      error: { code: 'E017', params: { loc: 'src/Page.tsx:20:5', reason: 'moved' } },
    });
  });

  it('#13 multi-file atomic write: leaves File A untouched on File B error, and calls onWritten once on success [R-SE-29]', async () => {
    const codeA =
      'export function CompA() {\n  return (\n    <div>\n      <p>From A</p>\n    </div>\n  );\n}\n';
    const codeB =
      'export function CompB() {\n  return (\n    <section>\n      <span>From B</span>\n    </section>\n  );\n}\n';
    await writePage(codeA, 'src/CompA.tsx');
    await writePage(codeB, 'src/CompB.tsx');

    let writtenCalls: Array<readonly WrittenFile[]> = [];
    const elA = { loc: 'src/CompA.tsx:4:7', tag: 'p' };
    const failRes = await service.applyStructureEdit(
      tmpDir,
      { kind: 'remove', elements: [elA, { loc: 'src/CompB.tsx:3:5', tag: 'section' }] },
      (files) => writtenCalls.push(files),
    );
    expect(failRes).toEqual({
      ok: false,
      error: { code: 'E023', params: { loc: 'src/CompB.tsx:3:5', reason: 'rootElement' } },
    });
    expect(writtenCalls).toHaveLength(0);
    expect(await readPage('src/CompA.tsx')).toBe(codeA);
    expect(await readPage('src/CompB.tsx')).toBe(codeB);

    writtenCalls = [];
    const okRes = await service.applyStructureEdit(
      tmpDir,
      { kind: 'remove', elements: [{ loc: 'src/CompB.tsx:4:7', tag: 'span' }, elA] },
      (files) => writtenCalls.push(files),
    );
    expect(okRes.ok && okRes.value.files).toEqual(['src/CompA.tsx', 'src/CompB.tsx']);
    expect(writtenCalls).toHaveLength(1);
    expect(writtenCalls[0]?.map((f) => f.path)).toEqual(['src/CompA.tsx', 'src/CompB.tsx']);
  });

  it('#14 round-trip duplicate then remove on every valid JSXElement in fixture and template files', async () => {
    const roots = [
      path.join(REPO_ROOT, 'fixtures/projects/vite8-react19-ts/src'),
      path.join(REPO_ROOT, 'templates/vite-react-ts-tailwind4/src'),
    ];
    const directFs = {
      ...nodeFs,
      writeTextAtomic: async (root: string, rel: string, content: string) => {
        await fs.writeFile(path.join(root, rel), content, 'utf8');
        return { ok: true as const, value: undefined };
      },
    };
    const fastService = createSourceEditorService({ fs: directFs }, { sourceDir: 'src' });
    let totalFiles = 0;
    let totalElements = 0;
    for (const srcRoot of roots) {
      const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-rt-'));
      try {
        await fs.cp(srcRoot, path.join(workDir, 'src'), { recursive: true });
        for (const rel of await listTsxFiles(path.join(workDir, 'src'))) {
          const abs = path.join(workDir, rel);
          const original = await fs.readFile(abs, 'utf8');
          totalFiles++;
          for (const el of collectValidJsxElements(parseJsxAst(original), rel)) {
            totalElements++;
            const dupRes = await fastService.applyStructureEdit(workDir, {
              kind: 'duplicate',
              elements: [el],
            });
            expect(dupRes.ok, `duplicate failed at ${el.loc}`).toBe(true);
            if (!dupRes.ok || !dupRes.value.locs[0]) continue;
            const rmRes = await fastService.applyStructureEdit(workDir, {
              kind: 'remove',
              elements: [{ loc: dupRes.value.locs[0], tag: el.tag }],
            });
            expect(rmRes.ok, `remove failed at ${dupRes.value.locs[0]}`).toBe(true);
            expect(await fs.readFile(abs, 'utf8')).toBe(original);
          }
        }
      } finally {
        await fs.rm(workDir, { recursive: true, force: true });
      }
    }
    // Every file and a real number of elements went round (18 files, 72 elements on 2026-10-17).
    expect(totalFiles).toBeGreaterThanOrEqual(18);
    expect(totalElements).toBeGreaterThanOrEqual(60);
  }, 20_000);

  it('preserves UTF-8 BOM, CRLF line endings, and tab indentation [section 4.7]', async () => {
    await writePage(
      '\uFEFFexport function Page() {\r\n\treturn (\r\n\t\t<div>\r\n\t\t\t<p>Item</p>\r\n\t\t</div>\r\n\t);\r\n}\r\n',
    );
    const insRes = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'sibling', ref: { loc: 'src/Page.tsx:4:4', tag: 'p' }, where: 'after' },
      jsx: '<div>\n  <span>Sub</span>\n</div>',
    });
    expect(insRes.ok).toBe(true);
    expect(await readPage()).toBe(
      '\uFEFFexport function Page() {\r\n\treturn (\r\n\t\t<div>\r\n\t\t\t<p>Item</p>\r\n\t\t\t<div>\r\n\t\t\t\t<span>Sub</span>\r\n\t\t\t</div>\r\n\t\t</div>\r\n\t);\r\n}\r\n',
    );
  });
});
