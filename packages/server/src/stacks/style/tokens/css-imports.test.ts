// Tests for following @import to the file that holds the variables (K9.5, R-ST-11).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { directWriteFs, makeTempDir } from '../../../services/workspace/test-support.ts';
import { cssImportsOf, resolveCssImport } from './css-imports.ts';
import { cssAdapter } from './tokens-css.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('css imports [K9.5]', () => {
  it('keeps relative .css imports inside the project only', () => {
    expect(resolveCssImport('src/styles/index.css', './common/global.css')).toBe(
      'src/styles/common/global.css',
    );
    expect(resolveCssImport('src/styles/common/global.css', '../tokens.css')).toBe(
      'src/styles/tokens.css',
    );
    expect(resolveCssImport('src/index.css', '../../outside.css')).toBeUndefined();
    expect(resolveCssImport('src/index.css', 'tailwindcss')).toBeUndefined();
    expect(resolveCssImport('src/index.css', 'https://fonts.example/x.css')).toBeUndefined();
    expect(resolveCssImport('src/index.css', './theme.scss')).toBeUndefined();
    expect(
      cssImportsOf(
        "/* @import './old.css'; */\n@import url('./a.css');\n@import \"./b.css\";",
        'src/x.css',
      ),
    ).toEqual(['src/a.css', 'src/b.css']);
  });

  it('reads variables two imports away, edits them there, adds new ones there', async () => {
    await mkdir(join(dir, 'src', 'styles', 'common'), { recursive: true });
    await writeFile(join(dir, 'src', 'styles', 'index.css'), "@import './common/global.css';\n");
    await writeFile(
      join(dir, 'src', 'styles', 'common', 'global.css'),
      "@import './tokens.css';\n@import './global.css';\nbody { margin: 0; }\n",
    );
    const tokensPath = join(dir, 'src', 'styles', 'common', 'tokens.css');
    await writeFile(tokensPath, ':root {\n  --color-primary: #16a34a;\n  --radius-md: 8px;\n}\n');
    const files = {
      root: dir,
      styling: {
        systems: [{ id: 'css' as const }],
        editable: true,
        globalCss: ['src/styles/index.css'],
      },
      tailwindCss: undefined,
      sourceDir: 'src',
    };

    const read = await cssAdapter.read(directWriteFs, files);
    expect(read.ok && read.value.file).toBe('src/styles/common/tokens.css');
    expect(read.ok && read.value.colors.map((c) => c.name)).toEqual(['primary']);

    const set = await cssAdapter.plan(directWriteFs, files, {
      op: 'set',
      kind: 'color',
      name: 'primary',
      value: '#ff00aa',
    });
    expect(set.ok && set.value.file).toBe('src/styles/common/tokens.css');
    expect(set.ok && set.value.after).toContain('--color-primary: #ff00aa;');

    const add = await cssAdapter.plan(directWriteFs, files, {
      op: 'add',
      kind: 'color',
      name: 'accent',
      value: '#123456',
    });
    expect(add.ok && add.value.file).toBe('src/styles/common/tokens.css');
    // Planning writes nothing.
    expect(await readFile(tokensPath, 'utf8')).not.toContain('#ff00aa');
  });
});
