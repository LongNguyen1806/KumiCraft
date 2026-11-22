// Unit tests for Tailwind 3 tailwind.config.* token adapter (SPEC-04 R-ST-11).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { directWriteFs } from '../../../services/workspace/test-support.ts';
import type { TokenFiles } from './token-types.ts';
import { tailwind3Adapter } from './tokens-tailwind3.ts';

function makeTokenFiles(root: string): TokenFiles {
  return {
    root,
    styling: {
      systems: [{ id: 'tailwind', version: '3.4.17' }],
      primary: 'tailwind',
      editable: true,
      globalCss: ['src/index.css'],
    },
    tailwindCss: 'src/index.css',
    sourceDir: 'src',
  };
}

describe('tokens-tailwind3 adapter [R-ST-11]', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kc-tw3-tokens-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('14. [R-ST-11] reads module.exports, export default defineConfig, and satisfies Config with nested colors brand-500, DEFAULT -> brand, and card borderRadius', async () => {
    const cjsConfig = `module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#e11d48',
          500: '#f43f5e',
        },
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
};
`;
    await fs.writeFile(path.join(tmpDir, 'tailwind.config.cjs'), cjsConfig, 'utf8');
    const cjsRes = await tailwind3Adapter.read(directWriteFs, makeTokenFiles(tmpDir));
    expect(cjsRes.ok).toBe(true);
    if (!cjsRes.ok) return;
    expect(cjsRes.value.file).toBe('tailwind.config.cjs');
    expect(cjsRes.value.colors).toEqual([
      { name: 'brand', value: '#e11d48' },
      { name: 'brand-500', value: '#f43f5e' },
    ]);
    expect(cjsRes.value.radii).toEqual([{ name: 'card', value: '12px' }]);

    await fs.rm(path.join(tmpDir, 'tailwind.config.cjs'));
    const defineConfigJs = `import { defineConfig } from 'tailwindcss';
export default defineConfig({
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#e11d48', 500: '#f43f5e' },
      },
      borderRadius: { card: '12px' },
    },
  },
});
`;
    await fs.writeFile(path.join(tmpDir, 'tailwind.config.js'), defineConfigJs, 'utf8');
    const defRes = await tailwind3Adapter.read(directWriteFs, makeTokenFiles(tmpDir));
    expect(defRes.ok).toBe(true);
    if (!defRes.ok) return;
    expect(defRes.value.colors).toEqual([
      { name: 'brand', value: '#e11d48' },
      { name: 'brand-500', value: '#f43f5e' },
    ]);
    expect(defRes.value.radii).toEqual([{ name: 'card', value: '12px' }]);

    await fs.rm(path.join(tmpDir, 'tailwind.config.js'));
    const satisfiesTs = `import type { Config } from 'tailwindcss';
export default {
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#e11d48', 500: '#f43f5e' },
      },
      borderRadius: { card: '12px' },
    },
  },
} satisfies Config;
`;
    await fs.writeFile(path.join(tmpDir, 'tailwind.config.ts'), satisfiesTs, 'utf8');
    const tsRes = await tailwind3Adapter.read(directWriteFs, makeTokenFiles(tmpDir));
    expect(tsRes.ok).toBe(true);
    if (!tsRes.ok) return;
    expect(tsRes.value.file).toBe('tailwind.config.ts');
    expect(tsRes.value.colors).toEqual([
      { name: 'brand', value: '#e11d48' },
      { name: 'brand-500', value: '#f43f5e' },
    ]);
    expect(tsRes.value.radii).toEqual([{ name: 'card', value: '12px' }]);
  });

  it('15. [R-ST-11] set brand-500 replaces only the literal in file preserving quotes and surrounding bytes, and remove deletes the property and comma', async () => {
    const initial = `// Header comment kept intact
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#e11d48',
          500: "#f43f5e", // inline comment
        },
      },
      borderRadius: {
        card: '12px',
        pill: '9999px',
      },
    },
  },
};
`;
    await fs.writeFile(path.join(tmpDir, 'tailwind.config.js'), initial, 'utf8');
    const files = makeTokenFiles(tmpDir);

    const setPlan = await tailwind3Adapter.plan(directWriteFs, files, {
      op: 'set',
      kind: 'color',
      name: 'brand-500',
      value: '#be123c',
    });
    expect(setPlan.ok).toBe(true);
    if (!setPlan.ok) return;
    expect(setPlan.value.after).toBe(initial.replace('"#f43f5e"', '"#be123c"'));

    await fs.writeFile(path.join(tmpDir, 'tailwind.config.js'), setPlan.value.after, 'utf8');
    const removePlan = await tailwind3Adapter.plan(directWriteFs, files, {
      op: 'remove',
      kind: 'radius',
      name: 'card',
    });
    expect(removePlan.ok).toBe(true);
    if (!removePlan.ok) return;
    expect(removePlan.value.after).toBe(setPlan.value.after.replace("        card: '12px',\n", ''));
  });

  it('16. [R-ST-11] add color accent when extend is missing creates extend: { colors: { accent: ... } } with matching indentation, and editing a theme-level token returns E016 tokenNotEditable', async () => {
    const initial = `export default {
  theme: {
    colors: {
      primary: '#111827',
    },
  },
};
`;
    await fs.writeFile(path.join(tmpDir, 'tailwind.config.js'), initial, 'utf8');
    const files = makeTokenFiles(tmpDir);

    const notEditableRes = await tailwind3Adapter.plan(directWriteFs, files, {
      op: 'set',
      kind: 'color',
      name: 'primary',
      value: '#000000',
    });
    expect(notEditableRes.ok).toBe(false);
    if (!notEditableRes.ok) {
      expect(notEditableRes.error.code).toBe('E016');
      expect(notEditableRes.error.params?.['reason']).toBe('tokenNotEditable');
    }

    const addPlan = await tailwind3Adapter.plan(directWriteFs, files, {
      op: 'add',
      kind: 'color',
      name: 'accent',
      value: '#10b981',
    });
    expect(addPlan.ok).toBe(true);
    if (!addPlan.ok) return;
    expect(addPlan.value.after).toBe(`export default {
  theme: {
    colors: {
      primary: '#111827',
    },
    extend: {
      colors: {
        accent: '#10b981',
      },
    },
  },
};
`);
  });
});
