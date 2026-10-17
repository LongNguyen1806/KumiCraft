// JSX children and newline, BOM, tab keeping of structural edits (R-SE-20, R-SE-10).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../../workspace/test-support.ts';
import { asAstNode, type AstNode, parseJsxAst } from '../ast-helpers.ts';
import { createSourceEditorService } from '../source-editor-service.ts';
import { jsxChildren } from './jsx-children.ts';

describe('structure edits: children and file format', () => {
  let tmpDir: string;
  let service: ReturnType<typeof createSourceEditorService>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-struct-format-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const writePage = (code: string) => fs.writeFile(path.join(tmpDir, 'src/Page.tsx'), code, 'utf8');
  const readPage = () => fs.readFile(path.join(tmpDir, 'src/Page.tsx'), 'utf8');

  it('counts JSX children without blank text and comments [R-SE-20]', () => {
    const ast = parseJsxAst('const x = <div>{/* c */}  <a/> text {x}</div>;');
    let root: AstNode | undefined;
    const find = (node: unknown): void => {
      const n = asAstNode(node);
      if (n === undefined || root !== undefined) return;
      if (n.type === 'JSXElement') {
        root = n;
        return;
      }
      for (const [key, value] of Object.entries(n)) {
        if (key !== 'loc') (Array.isArray(value) ? value : [value]).forEach(find);
      }
    };
    find(ast);

    const kinds = jsxChildren(root ?? { type: 'none' }).map((c) => c.type);

    expect(kinds).toEqual(['JSXElement', 'JSXText', 'JSXExpressionContainer']);
  });

  it('removes and duplicates in a CRLF file with BOM and tabs without mixing newlines [R-SE-10]', async () => {
    const original =
      '\uFEFFexport function Page() {\r\n\treturn (\r\n\t\t<div>\r\n\t\t\t<p>A</p>\r\n\t\t\t<b>B</b>\r\n\t\t</div>\r\n\t);\r\n}\r\n';
    await writePage(original);

    const dup = await service.applyStructureEdit(tmpDir, {
      kind: 'duplicate',
      elements: [{ loc: 'src/Page.tsx:4:4', tag: 'p' }],
    });
    expect(await readPage()).toBe(
      '\uFEFFexport function Page() {\r\n\treturn (\r\n\t\t<div>\r\n\t\t\t<p>A</p>\r\n\t\t\t<p>A</p>\r\n\t\t\t<b>B</b>\r\n\t\t</div>\r\n\t);\r\n}\r\n',
    );

    const copy = dup.ok ? dup.value.locs[0] : undefined;
    await service.applyStructureEdit(tmpDir, {
      kind: 'remove',
      elements: [{ loc: copy ?? 'missing', tag: 'p' }],
    });
    expect(await readPage()).toBe(original);
  });
});
