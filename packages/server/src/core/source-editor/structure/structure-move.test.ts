import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../../workspace/test-support.ts';
import { createSourceEditorService, type WrittenFile } from '../source-editor-service.ts';

describe('M-SE: Move, ElementText, and Imports [WP-2.02b]', () => {
  let tmpDir: string;
  let service: ReturnType<typeof createSourceEditorService>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-move-test-'));
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

  it('#1 [R-SE-24] moves c sibling before a', async () => {
    await writePage(
      `export function Page() {
  return (
    <ul>
      <li id="a">A</li>
      <li id="b">B</li>
      <li id="c">C</li>
    </ul>
  );
}
`,
    );

    const res = await service.applyStructureEdit(tmpDir, {
      kind: 'move',
      elements: [{ loc: 'src/Page.tsx:6:7', tag: 'li' }],
      target: { kind: 'sibling', ref: { loc: 'src/Page.tsx:4:7', tag: 'li' }, where: 'before' },
    });
    expect(res.ok).toBe(true);
    expect(await readPage()).toBe(
      `export function Page() {
  return (
    <ul>
      <li id="c">C</li>
      <li id="a">A</li>
      <li id="b">B</li>
    </ul>
  );
}
`,
    );
  });

  it('#2 [R-SE-24] moves a after b, then b before a (returns changed: false)', async () => {
    await writePage(
      `export function Page() {
  return (
    <ul>
      <li id="a">A</li>
      <li id="b">B</li>
      <li id="c">C</li>
    </ul>
  );
}
`,
    );

    const res1 = await service.applyStructureEdit(tmpDir, {
      kind: 'move',
      elements: [{ loc: 'src/Page.tsx:4:7', tag: 'li' }],
      target: { kind: 'sibling', ref: { loc: 'src/Page.tsx:5:7', tag: 'li' }, where: 'after' },
    });
    expect(res1.ok).toBe(true);
    expect(await readPage()).toBe(
      `export function Page() {
  return (
    <ul>
      <li id="b">B</li>
      <li id="a">A</li>
      <li id="c">C</li>
    </ul>
  );
}
`,
    );

    const contentBefore = await readPage();
    const res2 = await service.applyStructureEdit(tmpDir, {
      kind: 'move',
      elements: [{ loc: 'src/Page.tsx:4:7', tag: 'li' }],
      target: { kind: 'sibling', ref: { loc: 'src/Page.tsx:5:7', tag: 'li' }, where: 'before' },
    });
    expect(res2.ok).toBe(true);
    if (res2.ok) {
      expect(res2.value.changed).toBe(false);
    }
    expect(await readPage()).toBe(contentBefore);
  });

  it('#3 [R-SE-24, R-SE-09] moves multiline div with indent 4 to child end of section with indent 2', async () => {
    await writePage(
      `export function Page() {
  return (
    <main>
      <section>
        <h1>Title</h1>
      </section>
      <div>
        <p>Line 1</p>
        <p>Line 2</p>
      </div>
    </main>
  );
}
`,
    );

    const res = await service.applyStructureEdit(tmpDir, {
      kind: 'move',
      elements: [{ loc: 'src/Page.tsx:7:7', tag: 'div' }],
      target: { kind: 'child', parent: { loc: 'src/Page.tsx:4:7', tag: 'section' }, where: 'end' },
    });
    expect(res.ok).toBe(true);
    expect(await readPage()).toBe(
      `export function Page() {
  return (
    <main>
      <section>
        <h1>Title</h1>
        <div>
          <p>Line 1</p>
          <p>Line 2</p>
        </div>
      </section>
    </main>
  );
}
`,
    );
  });

  it('#4 [R-SE-24] move into self or descendants returns E016 moveIntoSelf', async () => {
    const initial = `export function Page() {
  return (
    <main>
      <section>
        <div>
          <p>Child</p>
        </div>
      </section>
    </main>
  );
}
`;
    await writePage(initial);

    const resSelf = await service.applyStructureEdit(tmpDir, {
      kind: 'move',
      elements: [{ loc: 'src/Page.tsx:4:7', tag: 'section' }],
      target: {
        kind: 'child',
        parent: { loc: 'src/Page.tsx:4:7', tag: 'section' },
        where: 'start',
      },
    });
    expect(resSelf.ok).toBe(false);
    if (!resSelf.ok) {
      expect(resSelf.error.code).toBe('E016');
      expect(resSelf.error.params?.['reason']).toBe('moveIntoSelf');
    }
    expect(await readPage()).toBe(initial);

    const resDesc = await service.applyStructureEdit(tmpDir, {
      kind: 'move',
      elements: [{ loc: 'src/Page.tsx:4:7', tag: 'section' }],
      target: { kind: 'child', parent: { loc: 'src/Page.tsx:5:9', tag: 'div' }, where: 'end' },
    });
    expect(resDesc.ok).toBe(false);
    if (!resDesc.ok) {
      expect(resDesc.error.code).toBe('E016');
      expect(resDesc.error.params?.['reason']).toBe('moveIntoSelf');
    }
    expect(await readPage()).toBe(initial);
  });

  it('#5 [R-SE-24] move multiple elements with different parents returns E016 notSameParent', async () => {
    await writePage(
      `export function Page() {
  return (
    <div>
      <section>
        <p id="p1">P1</p>
      </section>
      <article>
        <p id="p2">P2</p>
      </article>
    </div>
  );
}
`,
    );

    const res = await service.applyStructureEdit(tmpDir, {
      kind: 'move',
      elements: [
        { loc: 'src/Page.tsx:5:9', tag: 'p' },
        { loc: 'src/Page.tsx:8:9', tag: 'p' },
      ],
      target: {
        kind: 'sibling',
        ref: { loc: 'src/Page.tsx:4:7', tag: 'section' },
        where: 'before',
      },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('E016');
      expect(res.error.params?.['reason']).toBe('notSameParent');
    }
  });

  it('#6 [R-SE-24, R-SE-23] moves Card from Home.tsx to App.tsx with auto-imports and single history entry', async () => {
    await fs.mkdir(path.join(tmpDir, 'src/components'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'src/pages'), { recursive: true });

    await fs.writeFile(
      path.join(tmpDir, 'src/components/Card.tsx'),
      `export function Card() { return <div>Card</div>; }\n`,
      'utf8',
    );

    await fs.writeFile(
      path.join(tmpDir, 'src/pages/Home.tsx'),
      `import { Card } from '../components/Card.tsx';

export function Home() {
  return (
    <main>
      <Card />
    </main>
  );
}
`,
      'utf8',
    );

    await fs.writeFile(
      path.join(tmpDir, 'src/App.tsx'),
      `import React from 'react';

export function App() {
  return (
    <div id="root">
      <h1>Hello</h1>
    </div>
  );
}
`,
      'utf8',
    );

    const writtenCalls: WrittenFile[][] = [];
    const res = await service.applyStructureEdit(
      tmpDir,
      {
        kind: 'move',
        elements: [{ loc: 'src/pages/Home.tsx:6:7', tag: 'Card' }],
        target: { kind: 'child', parent: { loc: 'src/App.tsx:5:5', tag: 'div' }, where: 'end' },
      },
      (files) => writtenCalls.push([...files]),
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.files).toContain('src/pages/Home.tsx');
      expect(res.value.files).toContain('src/App.tsx');
    }

    expect(writtenCalls).toHaveLength(1);
    const recordedFiles = writtenCalls[0]?.map((f) => f.path).sort();
    expect(recordedFiles).toEqual(['src/App.tsx', 'src/pages/Home.tsx']);

    const appContent = await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8');
    expect(appContent).toContain("import { Card } from './components/Card.tsx';");
    expect(appContent).toContain('<Card />');

    const homeContent = await fs.readFile(path.join(tmpDir, 'src/pages/Home.tsx'), 'utf8');
    expect(homeContent).not.toContain('<Card />');

    if (writtenCalls[0]) {
      for (const w of writtenCalls[0]) {
        if (w.before !== undefined) {
          await fs.writeFile(path.join(tmpDir, w.path), w.before, 'utf8');
        }
      }
    }
    const homeRestored = await fs.readFile(path.join(tmpDir, 'src/pages/Home.tsx'), 'utf8');
    expect(homeRestored).toContain('<Card />');
  });

  it('#7 [R-SE-23] insert with from.imports using alias @/components/Card, and missingImport warning for Unknown', async () => {
    await writePage(
      `import React from 'react';

export function Page() {
  return (
    <div>
      <p>Content</p>
    </div>
  );
}
`,
    );

    const res1 = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'sibling', ref: { loc: 'src/Page.tsx:6:7', tag: 'p' }, where: 'after' },
      jsx: '<Card />',
      from: {
        file: 'src/Other.tsx',
        imports: ["import { Card } from '@/components/Card';"],
      },
    });
    expect(res1.ok).toBe(true);
    const content1 = await readPage();
    expect(content1).toContain("import { Card } from '@/components/Card';");

    const res2 = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'sibling', ref: { loc: 'src/Page.tsx:7:7', tag: 'p' }, where: 'before' },
      jsx: '<Unknown />',
      from: {
        file: 'src/Other.tsx',
        imports: [],
      },
    });
    expect(res2.ok).toBe(true);
    if (res2.ok) {
      expect(res2.value.warnings).toContain('missingImport');
    }
    const content2 = await readPage();
    expect(content2).toContain('<Unknown />');
  });

  it('#8 [R-SE-23] does not add import if already imported or defined top-level', async () => {
    await writePage(
      `import { Card } from './components/Card.tsx';

function Button() { return <button />; }

export function Page() {
  return (
    <div>
      <p>Content</p>
    </div>
  );
}
`,
    );

    const res1 = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'sibling', ref: { loc: 'src/Page.tsx:8:7', tag: 'p' }, where: 'after' },
      jsx: '<Card />',
      from: {
        file: 'src/Other.tsx',
        imports: ["import { Card } from './components/Card.tsx';"],
      },
    });
    expect(res1.ok).toBe(true);
    const content1 = await readPage();
    const importCardCount = (content1.match(/import\s+\{\s*Card\s*\}\s+from/g) || []).length;
    expect(importCardCount).toBe(1);

    const res2 = await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'sibling', ref: { loc: 'src/Page.tsx:8:7', tag: 'p' }, where: 'after' },
      jsx: '<Button />',
      from: {
        file: 'src/Other.tsx',
        imports: ["import { Button } from './components/Button.tsx';"],
      },
    });
    expect(res2.ok).toBe(true);
    const content2 = await readPage();
    expect(content2).not.toContain("import { Button } from './components/Button.tsx';");
  });

  it('#14 [R-SE-30] getElementText returns unindented jsx and verbatim imports', async () => {
    await writePage(
      `import { Button } from './Button.tsx';
import { Card } from './Card.tsx';
import { Other } from './Other.tsx';

export function Page() {
  return (
    <main>
      <section>
        <Card title="Test" />
        <Button>Click</Button>
      </section>
    </main>
  );
}
`,
    );

    const res = await service.getElementText(tmpDir, 'src/Page.tsx:8:7');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.file).toBe('src/Page.tsx');
      expect(res.value.jsx.startsWith('<section>')).toBe(true);
      expect(res.value.jsx).toContain('  <Card title="Test" />');
      expect(res.value.jsx).toContain('  <Button>Click</Button>');
      expect(res.value.jsx.endsWith('</section>')).toBe(true);
      expect(res.value.imports).toHaveLength(2);
      expect(res.value.imports).toContain("import { Button } from './Button.tsx';");
      expect(res.value.imports).toContain("import { Card } from './Card.tsx';");
      expect(res.value.imports).not.toContain("import { Other } from './Other.tsx';");
    }
  });
});
