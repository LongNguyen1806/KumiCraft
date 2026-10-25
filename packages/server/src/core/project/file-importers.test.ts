import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import { toSupportedPlatform } from '../shared/session.ts';
import { findFileImporters } from './file-importers.ts';

const platform = toSupportedPlatform(process.platform) ?? 'linux';
const fs = createNodeFileSystem(platform);

describe('file-importers [WP-4.00]', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'kumicraft-importers-'));
    await mkdir(join(root, 'src', 'components'), { recursive: true });
    await mkdir(join(root, 'src', 'styles'), { recursive: true });

    // Target file
    await writeFile(join(root, 'src', 'components', 'Header.jsx'), 'export function Header() {}');

    // Importer 1: App.jsx imports relative without extension
    await writeFile(
      join(root, 'src', 'App.jsx'),
      `import { Header } from './components/Header';\nexport default function App() {}`,
    );

    // Importer 2: Layout.tsx imports via @/ alias with extension
    await writeFile(
      join(root, 'src', 'Layout.tsx'),
      `import { Header } from '@/components/Header.jsx';\nexport function Layout() {}`,
    );

    // Not an importer: CSS file using @import
    await writeFile(
      join(root, 'src', 'styles', 'main.css'),
      `@import './theme.css';\nbody { margin: 0; }`,
    );

    // Not an importer: file with import only in comments
    await writeFile(
      join(root, 'src', 'Commented.jsx'),
      `// import { Header } from './components/Header';\n/* import "@/components/Header.jsx" */\nexport const x = 1;`,
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('[WP-4.00] file-importers: Header.jsx imported by App.jsx (./components/Header), Layout.tsx (@/components/Header.jsx), CSS @import not counted; import in comments not counted', async () => {
    const res = await findFileImporters(fs, root, 'src', 'src/components/Header.jsx');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.importers).toContain('src/App.jsx');
    expect(res.value.importers).toContain('src/Layout.tsx');
    expect(res.value.importers).not.toContain('src/styles/main.css');
    expect(res.value.importers).not.toContain('src/Commented.jsx');
    expect(res.value.importers.length).toBe(2);
  });

  it('[WP-4.00] file-importers: directory components -> files importing any file inside', async () => {
    const res = await findFileImporters(fs, root, 'src', 'src/components');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.importers).toContain('src/App.jsx');
    expect(res.value.importers).toContain('src/Layout.tsx');
    expect(res.value.importers).not.toContain('src/Commented.jsx');
    expect(res.value.importers.length).toBe(2);
  });
});
