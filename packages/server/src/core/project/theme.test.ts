import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir, nodeFs } from '../workspace/test-support.ts';
import { readThemeTokens } from './theme.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('readThemeTokens [R-PJ-17]', () => {
  it('reads @theme inline and skips line-height tokens [R-PJ-17]', async () => {
    const css =
      '@import "tailwindcss";\n@theme inline {\n  --color-brand: #f00;\n  --text-hero: 3rem;\n  --text-hero--line-height: 1.1;\n  --radius-card: 12px;\n}\n';
    await writeFile(join(dir, 't.css'), css);

    const result = await readThemeTokens(nodeFs, dir, 't.css');
    expect(result).toEqual({
      ok: true,
      value: {
        file: 't.css',
        colors: [{ name: 'brand', value: '#f00' }],
        fontSizes: [{ name: 'hero', value: '3rem' }],
        radii: [{ name: 'card', value: '12px' }],
        fonts: [],
        shadows: [],
        breakpoints: [],
      },
    });
  });
});
