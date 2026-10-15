// Usages of a component over the project (R-SE-14, M-SE test table #13).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir, nodeFs } from '../workspace/test-support.ts';
import { createSourceEditorService } from './source-editor-service.ts';

let dir: string;
let cleanup: () => Promise<void>;

async function write(file: string, content: string): Promise<void> {
  await mkdir(dirname(join(dir, file)), { recursive: true });
  await writeFile(join(dir, file), content);
}

const CARD = `export function Card({ title }: { title: string }) {
  return (
    <div className="rounded border p-4">
      <h3>{title}</h3>
    </div>
  );
}
`;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
  await write(
    'tsconfig.json',
    '{\n  // paths of the project\n  "compilerOptions": { "paths": { "@/*": ["./src/*"] } }\n}\n',
  );
  await write('src/components/Card.tsx', CARD);
});

afterEach(async () => {
  await cleanup();
});

const editor = () => createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });

describe('component usages', () => {
  it('counts a component imported under other names, by relative path and the @/ alias [R-SE-14]', async () => {
    await write(
      'src/pages/Home.tsx',
      'import { Card as Relative } from \'../components/Card.tsx\';\nexport function Home() {\n  return <main><Relative title="a" /></main>;\n}\n',
    );
    await write(
      'src/pages/About.tsx',
      'import { Card } from \'@/components/Card\';\nexport function About() {\n  return <main><Card title="b" /></main>;\n}\n',
    );

    const element = await editor().getElement(dir, 'src/components/Card.tsx:3:5');

    expect(element).toMatchObject({ ok: true, value: { component: { name: 'Card', usages: 2 } } });
  });

  it('counts a page used only by the routes once [R-SE-14]', async () => {
    await write(
      'src/pages/Home.tsx',
      'export function Home() {\n  return <main className="p-8">Home</main>;\n}\n',
    );
    await write(
      'src/routes.tsx',
      "import { Home } from './pages/Home.tsx';\nexport const routes = [{ path: '/', element: <Home /> }];\n",
    );

    const element = await editor().getElement(dir, 'src/pages/Home.tsx:2:10');

    expect(element).toMatchObject({ ok: true, value: { component: { name: 'Home', usages: 1 } } });
  });

  it('follows default exports and ignores files that import another component of the same name', async () => {
    await write(
      'src/components/Badge.tsx',
      'export default function Badge() {\n  return <span className="badge">B</span>;\n}\n',
    );
    await write(
      'src/pages/Home.tsx',
      "import Badge from '../components/Badge';\nimport { Badge as Other } from '../other/Badge';\nexport function Home() {\n  return <main><Badge /><Badge /><Other /></main>;\n}\n",
    );

    const element = await editor().getElement(dir, 'src/components/Badge.tsx:2:10');

    expect(element).toMatchObject({ ok: true, value: { component: { name: 'Badge', usages: 2 } } });
  });

  it('keeps counting the same file and skips files that do not parse', async () => {
    await write(
      'src/pages/Broken.tsx',
      "import { Card } from '../components/Card';\nexport const x = <Card title=\n",
    );
    await write(
      'src/pages/Twice.tsx',
      'import { Card } from \'../components/Card\';\nexport function Twice() {\n  return <main><Card title="a" /><Card title="b" /></main>;\n}\n',
    );

    const element = await editor().getElement(dir, 'src/components/Card.tsx:3:5');

    expect(element).toMatchObject({ ok: true, value: { component: { usages: 2 } } });
  });
});
