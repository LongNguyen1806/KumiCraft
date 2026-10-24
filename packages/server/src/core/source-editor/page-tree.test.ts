// Element tree of a JSX file for external AI agents (R-AG-19, round 7a).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { PageTreeNode } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir, nodeFs } from '../workspace/test-support.ts';
import { createSourceEditorService } from './source-editor-service.ts';

let dir: string;
let cleanup: () => Promise<void>;
const service = createSourceEditorService({ fs: nodeFs });

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
  await mkdir(join(dir, 'src', 'pages'), { recursive: true });
});

afterEach(async () => {
  await cleanup();
});

const HOME = [
  "import { Card } from '../components/Card';",
  '',
  'export function Home() {',
  '  return (',
  '    <main className="p-4">',
  '      <Card title="x" />',
  '      <h1>Xin chào</h1>',
  '    </main>',
  '  );',
  '}',
  '',
].join('\n');

function countNodes(nodes: readonly PageTreeNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0);
}

function depthOf(nodes: readonly PageTreeNode[]): number {
  return nodes.reduce((deepest, node) => Math.max(deepest, 1 + depthOf(node.children)), 0);
}

describe('readPageTree [R-AG-19]', () => {
  it('lists elements and components with locs that the element tool accepts [R-AG-19]', async () => {
    await writeFile(join(dir, 'src', 'pages', 'Home.tsx'), HOME);

    const tree = await service.getPageTree(dir, 'src/pages/Home.tsx');

    expect(tree.ok).toBe(true);
    if (!tree.ok) return;
    const [main] = tree.value.roots;
    expect(main).toMatchObject({
      loc: 'src/pages/Home.tsx:5:5',
      tag: 'main',
      kind: 'element',
      className: 'p-4',
    });
    expect(main?.children.map((child) => [child.tag, child.kind, child.text])).toEqual([
      ['Card', 'component', undefined],
      ['h1', 'element', 'Xin chào'],
    ]);
    const heading = main?.children[1];
    const element = await service.getElement(dir, heading?.loc ?? '');
    expect(element.ok && element.value.tag).toBe('h1');
    expect(tree.value.truncated).toBe(false);
  });

  it('counts columns without the BOM, like the Bridge [R-AG-19, R-BR-02]', async () => {
    await writeFile(join(dir, 'src', 'pages', 'Bom.tsx'), '﻿export const A = () => <p>a</p>;\n');

    const tree = await service.getPageTree(dir, 'src/pages/Bom.tsx');

    expect(tree.ok && tree.value.roots[0]?.loc).toBe('src/pages/Bom.tsx:1:24');
  });

  it('marks fragments and leaves out dynamic class names [R-AG-19]', async () => {
    const code = [
      'export const L = ({ b, items }) => (',
      '  <>',
      "    <div className={cn('a', b)}>",
      '      {items.map((item) => <span key={item}>{item}</span>)}',
      '    </div>',
      '  </>',
      ');',
    ].join('\n');
    await writeFile(join(dir, 'src', 'pages', 'List.jsx'), code);

    const tree = await service.getPageTree(dir, 'src/pages/List.jsx');

    expect(tree.ok).toBe(true);
    if (!tree.ok) return;
    const [fragment] = tree.value.roots;
    expect(fragment?.kind).toBe('fragment');
    const div = fragment?.children[0];
    expect(div?.tag).toBe('div');
    expect(div?.className).toBeUndefined();
    expect(div?.children[0]?.tag).toBe('span');
  });

  it('cuts big trees at 2000 nodes and at maxDepth [R-AG-19]', async () => {
    const items = Array.from({ length: 3000 }, (_, i) => `      <li>${String(i)}</li>`);
    const code = ['export const Big = () => (', '  <ul>', ...items, '  </ul>', ');'].join('\n');
    await writeFile(join(dir, 'src', 'pages', 'Big.tsx'), code);

    const full = await service.getPageTree(dir, 'src/pages/Big.tsx');
    const shallow = await service.getPageTree(dir, 'src/pages/Big.tsx', 1);

    expect(full.ok && full.value.truncated).toBe(true);
    expect(full.ok && countNodes(full.value.roots)).toBeLessThanOrEqual(2000);
    expect(shallow.ok && shallow.value.truncated).toBe(true);
    expect(shallow.ok && depthOf(shallow.value.roots)).toBe(1);
  });

  it('refuses paths outside the project, non-JSX files and missing files [R-AG-19]', async () => {
    const escape = await service.getPageTree(dir, '../x.tsx');
    const notJsx = await service.getPageTree(dir, 'src/a.ts');
    const missing = await service.getPageTree(dir, 'src/pages/Nope.tsx');

    expect(!escape.ok && escape.error.code).toBe('E016');
    expect(!notJsx.ok && notJsx.error.code).toBe('E023');
    expect(!missing.ok && missing.error.code).toBe('E015');
  });
});
