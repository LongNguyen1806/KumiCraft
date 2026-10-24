// Test #6: Sass token adapter (R-ST-11).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { directWriteFs, makeTempDir } from '../../workspace/test-support.ts';
import { sassAdapter } from './tokens-sass.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('sassAdapter [R-ST-11]', () => {
  it('$brand cấp cao đọc được; $local trong .a { $local: red; } và trong @mixin không đọc; remove xóa đúng dòng [R-ST-11]', async () => {
    await mkdir(join(dir, 'src', 'styles'), { recursive: true });
    const scssPath = join(dir, 'src', 'styles', 'main.scss');
    const scssCode = `// Top comment
$brand: #e11d48;
$radius-card: 12px;

.a {
  $local: red;
  color: $local;
}

@mixin button-styles {
  $mixin-var: blue;
  background: $mixin-var;
}
`;
    await writeFile(scssPath, scssCode, 'utf-8');

    const files = {
      root: dir,
      styling: {
        systems: [{ id: 'sass' as const }],
        editable: true,
        primary: 'sass' as const,
        globalCss: ['src/styles/main.scss'],
      },
      tailwindCss: undefined,
      sourceDir: 'src',
    };

    const readRes = await sassAdapter.read(directWriteFs, files);
    expect(readRes.ok).toBe(true);
    if (!readRes.ok) return;

    expect(readRes.value.system).toBe('sass');
    const brandColor = readRes.value.colors.find((c) => c.name === 'brand');
    expect(brandColor).toBeDefined();
    expect(brandColor?.value).toBe('#e11d48');
    expect(brandColor?.variable).toBe('$brand');

    const cardRadius = readRes.value.radii.find((r) => r.name === 'card');
    expect(cardRadius).toBeDefined();
    expect(cardRadius?.value).toBe('12px');
    expect(cardRadius?.variable).toBe('$radius-card');

    // $local and $mixin-var must NOT be parsed
    expect(readRes.value.colors.find((c) => c.name === 'local')).toBeUndefined();
    expect(readRes.value.colors.find((c) => c.name === 'mixin-var')).toBeUndefined();

    // Test remove
    const planRes = await sassAdapter.plan(directWriteFs, files, {
      op: 'remove',
      kind: 'color',
      name: 'brand',
    });

    expect(planRes.ok).toBe(true);
    if (!planRes.ok) return;

    expect(planRes.value.after).not.toContain('$brand: #e11d48;');
    expect(planRes.value.after).toContain('$radius-card: 12px;');
    expect(planRes.value.after).toContain('$local: red;');
    expect(planRes.value.after).toContain('$mixin-var: blue;');
  });
});
