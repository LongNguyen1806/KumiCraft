// Test #7: Less token adapter (R-ST-11).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { directWriteFs, makeTempDir } from '../../workspace/test-support.ts';
import { lessAdapter } from './tokens-less.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('lessAdapter [R-ST-11]', () => {
  it('@brand: #e11d48; đọc được; @media, @import không bị coi là biến; set đổi đúng dòng [R-ST-11]', async () => {
    await mkdir(join(dir, 'src', 'styles'), { recursive: true });
    const lessPath = join(dir, 'src', 'styles', 'main.less');
    const lessCode = `@import "other.less";
@brand: #e11d48;
@radius-card: 12px;

@media (min-width: 768px) {
  .header {
    color: @brand;
  }
}
`;
    await writeFile(lessPath, lessCode, 'utf-8');

    const files = {
      root: dir,
      styling: {
        systems: [{ id: 'less' as const }],
        editable: true,
        primary: 'less' as const,
        globalCss: ['src/styles/main.less'],
      },
      tailwindCss: undefined,
      sourceDir: 'src',
    };

    const readRes = await lessAdapter.read(directWriteFs, files);
    expect(readRes.ok).toBe(true);
    if (!readRes.ok) return;

    expect(readRes.value.system).toBe('less');
    const brandColor = readRes.value.colors.find((c) => c.name === 'brand');
    expect(brandColor).toBeDefined();
    expect(brandColor?.value).toBe('#e11d48');
    expect(brandColor?.variable).toBe('@brand');

    const cardRadius = readRes.value.radii.find((r) => r.name === 'card');
    expect(cardRadius).toBeDefined();
    expect(cardRadius?.value).toBe('12px');
    expect(cardRadius?.variable).toBe('@radius-card');

    // @media and @import must NOT be treated as tokens
    expect(readRes.value.colors.find((c) => c.name === 'import')).toBeUndefined();
    expect(readRes.value.colors.find((c) => c.name === 'media')).toBeUndefined();

    // Test set
    const planRes = await lessAdapter.plan(directWriteFs, files, {
      op: 'set',
      kind: 'color',
      name: 'brand',
      value: '#2563eb',
    });

    expect(planRes.ok).toBe(true);
    if (!planRes.ok) return;

    expect(planRes.value.after).toContain('@brand: #2563eb;');
    expect(planRes.value.after).toContain('@import "other.less";');
    expect(planRes.value.after).toContain('@radius-card: 12px;');
    expect(planRes.value.after).toContain('@media (min-width: 768px) {');
  });
});
