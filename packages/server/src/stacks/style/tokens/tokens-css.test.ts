import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { directWriteFs, makeTempDir } from '../../../services/workspace/test-support.ts';
import { cssAdapter } from './tokens-css.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('tokens-css [R-ST-11, R-TH-11]', () => {
  it('reads :root across 2 globalCss files, preserves variable, system: "css", and ignores variables in other rules [R-ST-11]', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    const f1 = join(dir, 'src', 'theme1.css');
    const f2 = join(dir, 'src', 'theme2.css');
    await writeFile(
      f1,
      ':root {\n  --brand-blue: #1d4ed8;\n  --radius-card: 12px;\n}\n.card {\n  --local-color: #ff0000;\n}\n',
    );
    await writeFile(f2, ':root {\n  --shadow-soft: 0 4px 6px rgba(0,0,0,0.1);\n}\n');

    const files = {
      root: dir,
      styling: {
        systems: [{ id: 'css' as const }],
        editable: true,
        globalCss: ['src/theme1.css', 'src/theme2.css'],
      },
      tailwindCss: undefined,
      sourceDir: 'src',
    };

    const res = await cssAdapter.read(directWriteFs, files);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.system).toBe('css');
      expect(res.value.colors).toEqual([
        { name: 'brand-blue', value: '#1d4ed8', variable: '--brand-blue' },
      ]);
      expect(res.value.radii).toEqual([{ name: 'card', value: '12px', variable: '--radius-card' }]);
      expect(res.value.shadows).toEqual([
        { name: 'soft', value: '0 4px 6px rgba(0,0,0,0.1)', variable: '--shadow-soft' },
      ]);
    }
  });

  it('set modifies exactly one line and preserves other file bytes including CRLF and BOM [R-ST-11, R-TH-11]', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    const f1 = join(dir, 'src', 'theme1.css');
    const f2 = join(dir, 'src', 'theme2.css');

    // f1 has BOM and CRLF
    const f1Content = '\uFEFF:root {\r\n  --brand-blue: #1d4ed8;\r\n}\r\n';
    const f2Content = ':root {\n  --radius-card: 12px;\n}\n';
    await writeFile(f1, f1Content, 'utf8');
    await writeFile(f2, f2Content, 'utf8');

    const files = {
      root: dir,
      styling: {
        systems: [{ id: 'css' as const }],
        editable: true,
        globalCss: ['src/theme1.css', 'src/theme2.css'],
      },
      tailwindCss: undefined,
      sourceDir: 'src',
    };

    const planRes = await cssAdapter.plan(directWriteFs, files, {
      op: 'set',
      kind: 'color',
      name: 'brand-blue',
      value: '#2563eb',
    });

    expect(planRes.ok).toBe(true);
    if (planRes.ok) {
      expect(planRes.value.file).toBe('src/theme1.css');
      expect(planRes.value.before).toBe(f1Content);
      expect(planRes.value.after).toBe('\uFEFF:root {\r\n  --brand-blue: #2563eb;\r\n}\r\n');
    }
    expect(await readFile(f2, 'utf8')).toBe(f2Content);
  });

  it('add inserts :root after @import when missing, and rejects duplicate with tokenExists [R-ST-11]', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    const f1 = join(dir, 'src', 'style.css');
    await writeFile(f1, '@import "./other.css";\n\nbody { margin: 0; }\n');

    const files = {
      root: dir,
      styling: {
        systems: [{ id: 'css' as const }],
        editable: true,
        globalCss: ['src/style.css'],
      },
      tailwindCss: undefined,
      sourceDir: 'src',
    };

    const planRes = await cssAdapter.plan(directWriteFs, files, {
      op: 'add',
      kind: 'color',
      name: 'accent',
      value: '#f59e0b',
    });

    expect(planRes.ok).toBe(true);
    if (planRes.ok) {
      expect(planRes.value.file).toBe('src/style.css');
      expect(planRes.value.after).toContain(':root {\n  --color-accent: #f59e0b;\n}\n');
      expect(planRes.value.after.indexOf('@import')).toBeLessThan(
        planRes.value.after.indexOf(':root'),
      );
    }

    // Try adding token that already exists in a file
    await writeFile(f1, ':root {\n  --color-accent: #f59e0b;\n}\n');
    const dupRes = await cssAdapter.plan(directWriteFs, files, {
      op: 'add',
      kind: 'color',
      name: 'accent',
      value: '#f59e0b',
    });
    expect(dupRes).toEqual({
      ok: false,
      error: { code: 'E016', params: { reason: 'tokenExists' } },
    });
  });
});
