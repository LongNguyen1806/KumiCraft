// Server tests for duplicate import suppression and multi-specifier grouping on insert (TK-44, test 19).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../../workspace/test-support.ts';
import { createSourceEditorService } from '../source-editor-service.ts';

describe('M-SE: Import deduplication and grouping [TK-44]', () => {
  let tmpDir: string;
  let service: ReturnType<typeof createSourceEditorService>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-import-dedup-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    service = createSourceEditorService({ fs: nodeFs });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('19. inserting twice with the same from.imports yields only one import statement', async () => {
    const filePath = path.join(tmpDir, 'src/Page.tsx');
    await fs.writeFile(
      filePath,
      `export function Page() {\n  return (\n    <div>\n      <span>Hi</span>\n    </div>\n  );\n}\n`,
      'utf8',
    );

    const from = {
      file: 'src/Page.tsx',
      imports: ["import { Button } from '@/components/ui/button';"],
    };

    const first = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/Page.tsx:3:5', tag: 'div' }, where: 'end' },
      jsx: '<Button variant="outline">One</Button>',
      from,
    });
    expect(first.ok).toBe(true);

    const second = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/Page.tsx:4:5', tag: 'div' }, where: 'end' },
      jsx: '<Button variant="default">Two</Button>',
      from,
    });
    expect(second.ok).toBe(true);

    const content = await fs.readFile(filePath, 'utf8');
    const importMatches = content.match(
      /import\s*\{[^}]*Button[^}]*\}\s*from\s*['"]@\/components\/ui\/button['"]/g,
    );
    expect(importMatches).toHaveLength(1);
  });

  it('groups multiple named imports from one uiKit module into a single import line', async () => {
    const filePath = path.join(tmpDir, 'src/Page.tsx');
    await fs.writeFile(
      filePath,
      `export function Page() {\n  return (\n    <div>\n      <span>Hi</span>\n    </div>\n  );\n}\n`,
      'utf8',
    );

    const res = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/Page.tsx:3:5', tag: 'div' }, where: 'end' },
      jsx: `<Card>\n  <CardHeader>\n    <CardTitle>Title</CardTitle>\n  </CardHeader>\n  <CardContent>Body</CardContent>\n</Card>`,
      from: {
        file: 'src/Page.tsx',
        imports: [
          "import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';",
        ],
      },
    });
    expect(res.ok).toBe(true);

    const content = await fs.readFile(filePath, 'utf8');
    expect(content).toContain(
      "import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';",
    );
    expect(content.match(/from '@\/components\/ui\/card'/g)).toHaveLength(1);
  });
});
