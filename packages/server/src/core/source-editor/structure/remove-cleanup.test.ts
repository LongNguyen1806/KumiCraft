// The owner's report of 2026-11-16 on a free draft: a component placed there got a `className` it
// does not take (a type error, and no effect), and taking it off the page left its import behind.
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { StructureEdit } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../../workspace/test-support.ts';
import { createSourceEditorService, type SourceEditorService } from '../source-editor-service.ts';

const PAGE = 'src/Page.tsx';

describe('components in a free frame, and what a removal takes along [R-FF-12, R-SE-04]', () => {
  let tmpDir = '';
  let service: SourceEditorService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kc-remove-cleanup-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const write = (code: string) => fs.writeFile(path.join(tmpDir, PAGE), code, 'utf8');
  const read = () => fs.readFile(path.join(tmpDir, PAGE), 'utf8');
  const apply = async (edit: StructureEdit) => {
    const res = await service.applyStructureEdit(tmpDir, edit);
    expect(res.ok).toBe(true);
  };

  it('puts a component without className in a placing div; one with className gets the classes', async () => {
    await write(
      'export function Page() {\n  return <div data-rc-free className="relative min-h-screen"></div>;\n}\n',
    );
    const target = {
      kind: 'child',
      parent: { loc: `${PAGE}:2:10`, tag: 'div' },
      where: 'end',
    } as const;
    await apply({
      kind: 'insert',
      target,
      jsx: '<ProductCard name="Áo" />',
      placement: { kind: 'free', left: 16, top: 16 },
      tailwindMajor: 4,
    });
    await apply({
      kind: 'insert',
      target,
      jsx: '<Badge className="p-1" />',
      placement: { kind: 'free', left: 32, top: 32 },
      tailwindMajor: 4,
    });
    const code = await read();
    expect(code).toContain(
      '<div className="absolute left-4 top-4"><ProductCard name="Áo" /></div>',
    );
    expect(code).toContain('<Badge className="p-1 absolute left-8 top-8" />');
  });

  it('takes the placing div and the imports only the removed code read [R-SE-04]', async () => {
    await write(
      [
        "import { ProductCard } from './ProductCard';",
        "import { Other, Shared, Unused } from './Card';",
        'export function Page() {',
        '  return (',
        '    <div data-rc-free className="relative">',
        '      <div className="absolute left-4 top-4">',
        '        <ProductCard name="A" />',
        '      </div>',
        '      <Other />',
        '      <Shared />',
        '      <Shared />',
        '    </div>',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
    await apply({ kind: 'remove', elements: [{ loc: `${PAGE}:7:9`, tag: 'ProductCard' }] });
    let code = await read();
    expect(code).not.toContain('ProductCard');
    expect(code).not.toContain('absolute left-4 top-4');
    await apply({ kind: 'remove', elements: [{ loc: `${PAGE}:5:7`, tag: 'Other' }] });
    code = await read();
    // `Shared` is still read; `Unused` was never read, so it is not this removal's to drop.
    expect(code).toContain("import { Shared, Unused } from './Card';");
    expect(code).toContain('<Shared />');
  });

  it('takes the Reveal that shows only the removed element, and its import [R-SE-04]', async () => {
    await write(
      [
        "import { Reveal } from '../kumicraft/Reveal';",
        'export function Page() {',
        '  return <div data-rc-free className="relative">',
        '    <Reveal effect="fade">',
        '      <main className="absolute left-4 top-4">',
        '        <h1>Login</h1>',
        '      </main>',
        '    </Reveal>',
        '    <Reveal>',
        '      <p>One</p>',
        '      <p>Two</p>',
        '    </Reveal>',
        '  </div>;',
        '}',
        '',
      ].join('\n'),
    );
    await apply({ kind: 'remove', elements: [{ loc: `${PAGE}:5:7`, tag: 'main' }] });
    let code = await read();
    expect(code).not.toContain('<Reveal effect="fade">');
    expect(code).not.toContain('<main');
    expect(code).toContain("import { Reveal } from '../kumicraft/Reveal';");
    // A Reveal that still shows another element stays.
    await apply({ kind: 'remove', elements: [{ loc: `${PAGE}:5:7`, tag: 'p' }] });
    code = await read();
    expect(code).toContain('<Reveal>');
    expect(code).toContain('<p>Two</p>');
    await apply({ kind: 'remove', elements: [{ loc: `${PAGE}:5:7`, tag: 'p' }] });
    code = await read();
    expect(code).not.toContain('Reveal');
  });

  it('drops the placing div when the component leaves the free frame [R-FF-12]', async () => {
    await write(
      [
        'export function Page() {',
        '  return (',
        '    <div>',
        '      <div data-rc-free className="relative">',
        '        <div className="absolute left-4 top-4"><ProductCard name="A" /></div>',
        '      </div>',
        '      <section className="p-4"></section>',
        '    </div>',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
    await apply({
      kind: 'move',
      elements: [{ loc: `${PAGE}:5:9`, tag: 'div' }],
      target: { kind: 'child', parent: { loc: `${PAGE}:7:7`, tag: 'section' }, where: 'end' },
      placement: { kind: 'flow' },
    });
    const code = await read();
    expect(code).not.toContain('absolute');
    expect(code).toContain('<ProductCard name="A" />');
  });
});
