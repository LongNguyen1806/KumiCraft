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
import { directWriteFs, nodeFs } from '../../../../services/workspace/test-support.ts';
import { createSourceEditorService } from '../source-editor-service.ts';
import { checkElementStructureGuard } from './structure-guard.ts';
import { listTsxFiles, REPO_ROOT } from './test-support.ts';

type ValidElement = {
  readonly loc: string;
  readonly tag: string;
  readonly node: AstNode;
};

function collectAllValidJsxElements(ast: AstNode, rel: string): ValidElement[] {
  const valid: ValidElement[] = [];
  function walk(node: AstNode): void {
    if (node.type === 'JSXElement') {
      const opening = asAstNode(node['openingElement']);
      const tag = opening ? getJsxTagName(opening) : undefined;
      const startPos = opening?.loc?.start;
      if (tag && startPos) {
        const loc = `${rel}:${String(startPos.line)}:${String(startPos.column + 1)}`;
        if (checkElementStructureGuard(ast, node, loc).ok) {
          valid.push({ loc, tag, node });
        }
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

describe('M-SE: Wrap and Unwrap [WP-2.02b]', () => {
  let tmpDir: string;
  let service: ReturnType<typeof createSourceEditorService>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-wrap-test-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    service = createSourceEditorService({ fs: nodeFs });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writePage(content: string, filename = 'Page.tsx') {
    await fs.writeFile(path.join(tmpDir, 'src', filename), content, 'utf8');
  }

  async function readPage(filename = 'Page.tsx') {
    return fs.readFile(path.join(tmpDir, 'src', filename), 'utf8');
  }

  it('#9 [R-SE-27] wraps 2 contiguous buttons with row', async () => {
    await writePage(
      `export function Page() {
  return (
    <div>
      <button id="b1">Button 1</button>
      <button id="b2">Button 2</button>
    </div>
  );
}
`,
    );

    const res = await service.applyStructureEdit(tmpDir, {
      kind: 'wrap',
      elements: [
        { loc: 'src/Page.tsx:4:7', tag: 'button' },
        { loc: 'src/Page.tsx:5:7', tag: 'button' },
      ],
      wrapper: 'row',
    });
    expect(res.ok).toBe(true);
    expect(await readPage()).toBe(
      `export function Page() {
  return (
    <div>
      <div className="flex flex-row gap-4">
        <button id="b1">Button 1</button>
        <button id="b2">Button 2</button>
      </div>
    </div>
  );
}
`,
    );
    if (res.ok) {
      expect(res.value.locs).toEqual(['src/Page.tsx:4:7']);
    }
  });

  it('#10 [R-SE-27, R-SE-21] wrap non-contiguous or root return returns error', async () => {
    await writePage(
      `export function Page() {
  return (
    <div>
      <button id="b1">Button 1</button>
      <p>Between</p>
      <button id="b2">Button 2</button>
    </div>
  );
}
`,
    );

    const resNonContig = await service.applyStructureEdit(tmpDir, {
      kind: 'wrap',
      elements: [
        { loc: 'src/Page.tsx:4:7', tag: 'button' },
        { loc: 'src/Page.tsx:6:7', tag: 'button' },
      ],
      wrapper: 'column',
    });
    expect(resNonContig.ok).toBe(false);
    if (!resNonContig.ok) {
      expect(resNonContig.error.code).toBe('E016');
      expect(resNonContig.error.params?.['reason']).toBe('notContiguous');
    }

    const resRoot = await service.applyStructureEdit(tmpDir, {
      kind: 'wrap',
      elements: [{ loc: 'src/Page.tsx:3:5', tag: 'div' }],
      wrapper: 'grid',
    });
    expect(resRoot.ok).toBe(false);
    if (!resRoot.ok) {
      expect(resRoot.error.code).toBe('E023');
      expect(resRoot.error.params?.['reason']).toBe('rootElement');
    }
  });

  it('#11 [R-SE-28] unwraps div with 2 children, handles attributesDropped, componentTag, and nothingToUnwrap', async () => {
    // 1. Unwraps div with 2 children
    await writePage(
      `export function Page() {
  return (
    <main>
      <div className="flex">
        <span>C1</span>
        <span>C2</span>
      </div>
    </main>
  );
}
`,
    );
    const res1 = await service.applyStructureEdit(tmpDir, {
      kind: 'unwrap',
      element: { loc: 'src/Page.tsx:4:7', tag: 'div' },
    });
    expect(res1.ok).toBe(true);
    expect(await readPage()).toBe(
      `export function Page() {
  return (
    <main>
      <span>C1</span>
      <span>C2</span>
    </main>
  );
}
`,
    );

    // 2. attributesDropped warning
    await writePage(
      `export function Page() {
  return (
    <main>
      <div id="x">
        <p>Text</p>
      </div>
    </main>
  );
}
`,
    );
    const resAttr = await service.applyStructureEdit(tmpDir, {
      kind: 'unwrap',
      element: { loc: 'src/Page.tsx:4:7', tag: 'div' },
    });
    expect(resAttr.ok).toBe(true);
    if (resAttr.ok) {
      expect(resAttr.value.warnings).toContain('attributesDropped');
    }

    // 3. componentTag E023
    await writePage(
      `export function Page() {
  return (
    <main>
      <Card>
        <p>Card Child</p>
      </Card>
    </main>
  );
}
`,
    );
    const resComp = await service.applyStructureEdit(tmpDir, {
      kind: 'unwrap',
      element: { loc: 'src/Page.tsx:4:7', tag: 'Card' },
    });
    expect(resComp.ok).toBe(false);
    if (!resComp.ok) {
      expect(resComp.error.code).toBe('E023');
      expect(resComp.error.params?.['reason']).toBe('componentTag');
    }

    // 4. nothingToUnwrap E016
    await writePage(
      `export function Page() {
  return (
    <main>
      <p></p>
    </main>
  );
}
`,
    );
    const resEmpty = await service.applyStructureEdit(tmpDir, {
      kind: 'unwrap',
      element: { loc: 'src/Page.tsx:4:7', tag: 'p' },
    });
    expect(resEmpty.ok).toBe(false);
    if (!resEmpty.ok) {
      expect(resEmpty.error.code).toBe('E016');
      expect(resEmpty.error.params?.['reason']).toBe('nothingToUnwrap');
    }
  });

  it('#12 [R-SE-28] unwrap root return with 2 children fails E023 rootElement, with 1 child succeeds', async () => {
    await writePage(
      `export function Page() {
  return (
    <div>
      <h1>Heading</h1>
      <p>Paragraph</p>
    </div>
  );
}
`,
    );
    const resTwo = await service.applyStructureEdit(tmpDir, {
      kind: 'unwrap',
      element: { loc: 'src/Page.tsx:3:5', tag: 'div' },
    });
    expect(resTwo.ok).toBe(false);
    if (!resTwo.ok) {
      expect(resTwo.error.code).toBe('E023');
      expect(resTwo.error.params?.['reason']).toBe('rootElement');
    }

    await writePage(
      `export function Page() {
  return (
    <div>
      <main>Content</main>
    </div>
  );
}
`,
    );
    const resOne = await service.applyStructureEdit(tmpDir, {
      kind: 'unwrap',
      element: { loc: 'src/Page.tsx:3:5', tag: 'div' },
    });
    expect(resOne.ok).toBe(true);
    const content = await readPage();
    expect(content).toContain('<main>Content</main>');
    expect(content).not.toContain('<div>');
    expect(() => parseJsxAst(content)).not.toThrow();
  });

  it('#13 [R-SE-10] preserves CRLF, BOM, and tab indentation across move, wrap, and unwrap', async () => {
    const raw =
      '\uFEFFexport function Page() {\r\n' +
      '\treturn (\r\n' +
      '\t\t<div>\r\n' +
      '\t\t\t<button id="b1">B1</button>\r\n' +
      '\t\t\t<button id="b2">B2</button>\r\n' +
      '\t\t</div>\r\n' +
      '\t);\r\n' +
      '}\r\n';
    await writePage(raw);

    const moveRes = await service.applyStructureEdit(tmpDir, {
      kind: 'move',
      elements: [{ loc: 'src/Page.tsx:5:4', tag: 'button' }],
      target: { kind: 'sibling', ref: { loc: 'src/Page.tsx:4:4', tag: 'button' }, where: 'before' },
    });
    expect(moveRes.ok).toBe(true);
    const movedContent = await readPage();
    expect(movedContent.startsWith('\uFEFF')).toBe(true);
    expect(movedContent.includes('\r\n')).toBe(true);
    expect(movedContent.includes('\t\t\t<button id="b2">B2</button>')).toBe(true);

    const wrapRes = await service.applyStructureEdit(tmpDir, {
      kind: 'wrap',
      elements: [
        { loc: 'src/Page.tsx:4:4', tag: 'button' },
        { loc: 'src/Page.tsx:5:4', tag: 'button' },
      ],
      wrapper: 'row',
    });
    expect(wrapRes.ok).toBe(true);
    const wrappedContent = await readPage();
    expect(wrappedContent.startsWith('\uFEFF')).toBe(true);
    expect(wrappedContent.includes('\r\n')).toBe(true);
    expect(wrappedContent.includes('\t\t\t<div className="flex flex-row gap-4">')).toBe(true);

    if (wrapRes.ok && wrapRes.value.locs[0]) {
      const unwrapRes = await service.applyStructureEdit(tmpDir, {
        kind: 'unwrap',
        element: { loc: wrapRes.value.locs[0], tag: 'div' },
      });
      expect(unwrapRes.ok).toBe(true);
      const unwrappedContent = await readPage();
      expect(unwrappedContent.startsWith('\uFEFF')).toBe(true);
      expect(unwrappedContent.includes('\r\n')).toBe(true);
      expect(unwrappedContent).toBe(movedContent);
    }
  });

  it('#16 [R-SE-27, R-SE-28] round-trips wrap column then unwrap on every valid JSXElement in real files', async () => {
    const fast = createSourceEditorService({ fs: directWriteFs });
    const roots = [
      path.join(REPO_ROOT, 'fixtures/projects/vite8-react19-ts/src'),
      path.join(REPO_ROOT, 'templates/vite-react-ts-tailwind4/src'),
    ];
    let totalFiles = 0;
    let totalElements = 0;
    for (const srcRoot of roots) {
      const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-wrap-rt-'));
      try {
        await fs.cp(srcRoot, path.join(workDir, 'src'), { recursive: true });
        for (const rel of await listTsxFiles(path.join(workDir, 'src'))) {
          const abs = path.join(workDir, rel);
          const original = await fs.readFile(abs, 'utf8');
          totalFiles++;
          const ast = parseJsxAst(original);
          const validElements = collectAllValidJsxElements(ast, rel);
          for (const el of validElements) {
            totalElements++;
            const wrapRes = await fast.applyStructureEdit(workDir, {
              kind: 'wrap',
              elements: [el],
              wrapper: 'column',
            });
            expect(wrapRes.ok, `wrap failed at ${el.loc}`).toBe(true);
            if (!wrapRes.ok || !wrapRes.value.locs[0]) continue;

            const unwrapRes = await fast.applyStructureEdit(workDir, {
              kind: 'unwrap',
              element: { loc: wrapRes.value.locs[0], tag: 'div' },
            });
            expect(unwrapRes.ok, `unwrap failed at ${wrapRes.value.locs[0]}`).toBe(true);
            expect(await fs.readFile(abs, 'utf8')).toBe(original);
          }
        }
      } finally {
        await fs.rm(workDir, { recursive: true, force: true });
      }
    }
    expect(totalFiles).toBeGreaterThanOrEqual(18);
    expect(totalElements).toBeGreaterThanOrEqual(40);
  }, 30_000);
});
