// A component dropped into its own code, and imports of names the file already exports
// (spec-log #108: MainLayout dropped into MainLayout hung the Canvas).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../../workspace/test-support.ts';
import { createSourceEditorService } from '../source-editor-service.ts';

const LAYOUT = `import { Outlet } from 'react-router';

export function MainLayout() {
  return (
    <div>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export function Banner() {
  return <p>Hi</p>;
}
`;

describe('M-SE: a component never goes into itself [R-SE-23]', () => {
  let tmpDir: string;
  let service: ReturnType<typeof createSourceEditorService>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kc-self-insert-'));
    await fs.mkdir(path.join(tmpDir, 'src/layouts'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'src/layouts/MainLayout.tsx'), LAYOUT, 'utf8');
    service = createSourceEditorService({ fs: nodeFs });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const read = () => fs.readFile(path.join(tmpDir, 'src/layouts/MainLayout.tsx'), 'utf8');

  it('refuses MainLayout inside MainLayout and leaves the file as it was', async () => {
    const res = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: {
        kind: 'child',
        parent: { loc: 'src/layouts/MainLayout.tsx:6:7', tag: 'main' },
        where: 'end',
      },
      jsx: '<MainLayout />',
      from: {
        file: 'src/layouts/MainLayout.tsx',
        imports: ["import { MainLayout } from '@/layouts/MainLayout';"],
      },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatchObject({ code: 'E016', params: { reason: 'componentIntoItself' } });
    }
    expect(await read()).toBe(LAYOUT);
  });

  it('another component of the same file goes in, without importing what the file exports', async () => {
    const res = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: {
        kind: 'child',
        parent: { loc: 'src/layouts/MainLayout.tsx:6:7', tag: 'main' },
        where: 'end',
      },
      jsx: '<Banner />',
      from: {
        file: 'src/layouts/MainLayout.tsx',
        imports: ["import { Banner } from '@/layouts/MainLayout';"],
      },
    });
    expect(res.ok).toBe(true);
    const content = await read();
    expect(content).toContain('<Banner />');
    expect(content).not.toContain("import { Banner } from '@/layouts/MainLayout';");
  });
});
