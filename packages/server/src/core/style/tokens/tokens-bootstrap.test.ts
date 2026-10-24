// Tests #8, #9, #10: Bootstrap 5 token adapter (R-ST-11).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { directWriteFs, makeTempDir } from '../../workspace/test-support.ts';
import { bootstrapAdapter } from './tokens-bootstrap.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('bootstrapAdapter [R-ST-11]', () => {
  it('Chế độ CSS, chưa ghi đè → 8 màu inherited: true với giá trị mặc định; set primary #ff0000 → :root có --bs-primary: #ff0000; và --bs-primary-rgb: 255, 0, 0; [R-ST-11]', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    const cssPath = join(dir, 'src', 'index.css');
    await writeFile(cssPath, '/* empty css */\n', 'utf-8');

    const files = {
      root: dir,
      styling: {
        systems: [{ id: 'bootstrap' as const, version: '5.3.3' }],
        editable: true,
        primary: 'bootstrap' as const,
        globalCss: ['src/index.css'],
      },
      tailwindCss: undefined,
      sourceDir: 'src',
    };

    // 1. Read: 8 colors inherited: true
    const read1 = await bootstrapAdapter.read(directWriteFs, files);
    expect(read1.ok).toBe(true);
    if (!read1.ok) return;

    expect(read1.value.system).toBe('bootstrap5');
    expect(read1.value.colors).toHaveLength(8);
    for (const c of read1.value.colors) {
      expect(c.inherited).toBe(true);
    }
    const primaryColor = read1.value.colors.find((c) => c.name === 'primary');
    expect(primaryColor?.value).toBe('#0d6efd');
    expect(primaryColor?.variable).toBe('--bs-primary');

    // 2. Set primary #ff0000
    const planRes = await bootstrapAdapter.plan(directWriteFs, files, {
      op: 'set',
      kind: 'color',
      name: 'primary',
      value: '#ff0000',
    });
    expect(planRes.ok).toBe(true);
    if (!planRes.ok) return;

    expect(planRes.value.after).toContain('--bs-primary: #ff0000;');
    expect(planRes.value.after).toContain('--bs-primary-rgb: 255, 0, 0;');

    // Write back and re-read
    await writeFile(cssPath, planRes.value.after, 'utf-8');
    const read2 = await bootstrapAdapter.read(directWriteFs, files);
    expect(read2.ok).toBe(true);
    if (!read2.ok) return;
    const primaryAfter = read2.value.colors.find((c) => c.name === 'primary');
    expect(primaryAfter?.value).toBe('#ff0000');
    expect(primaryAfter?.inherited).toBeUndefined(); // overridden
  });

  it('Chế độ CSS, set primary rgb(1,2,3) → E016 invalidValue, file không đổi [R-ST-11]', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    const cssPath = join(dir, 'src', 'index.css');
    const initialContent = '/* bootstrap css */\n:root {\n  --bs-primary: #0d6efd;\n}\n';
    await writeFile(cssPath, initialContent, 'utf-8');

    const files = {
      root: dir,
      styling: {
        systems: [{ id: 'bootstrap' as const, version: '5.3.3' }],
        editable: true,
        primary: 'bootstrap' as const,
        globalCss: ['src/index.css'],
      },
      tailwindCss: undefined,
      sourceDir: 'src',
    };

    const planRes = await bootstrapAdapter.plan(directWriteFs, files, {
      op: 'set',
      kind: 'color',
      name: 'primary',
      value: 'rgb(1,2,3)',
    });

    expect(planRes.ok).toBe(false);
    if (planRes.ok) return;
    expect(planRes.error.code).toBe('E016');
    expect(planRes.error.params?.reason).toBe('invalidValue');

    // Check file content is unchanged
    const diskContent = await readFile(cssPath, 'utf-8');
    expect(diskContent).toBe(initialContent);
  });

  it('Chế độ Sass (main.scss có @import "bootstrap/scss/bootstrap";) → set primary thêm $primary: …; ngay trước dòng import; remove trả về inherited [R-ST-11]', async () => {
    await mkdir(join(dir, 'src', 'styles'), { recursive: true });
    const scssPath = join(dir, 'src', 'styles', 'main.scss');
    const initialScss = `// Custom vars here
$body-bg: #fff;

@import "bootstrap/scss/bootstrap";

.my-box {
  color: $primary;
}
`;
    await writeFile(scssPath, initialScss, 'utf-8');

    const files = {
      root: dir,
      styling: {
        systems: [{ id: 'bootstrap' as const, version: '5.3.3' }],
        editable: true,
        primary: 'bootstrap' as const,
        globalCss: ['src/styles/main.scss'],
      },
      tailwindCss: undefined,
      sourceDir: 'src',
    };

    // 1. Read: primary is inherited
    const read1 = await bootstrapAdapter.read(directWriteFs, files);
    expect(read1.ok).toBe(true);
    if (!read1.ok) return;
    const primary1 = read1.value.colors.find((c) => c.name === 'primary');
    expect(primary1?.inherited).toBe(true);

    // 2. Set primary #2563eb
    const planSet = await bootstrapAdapter.plan(directWriteFs, files, {
      op: 'set',
      kind: 'color',
      name: 'primary',
      value: '#2563eb',
    });
    expect(planSet.ok).toBe(true);
    if (!planSet.ok) return;

    expect(planSet.value.after).toContain('$primary: #2563eb;');
    const importIndex = planSet.value.after.indexOf('@import "bootstrap/scss/bootstrap";');
    const varIndex = planSet.value.after.indexOf('$primary: #2563eb;');
    expect(varIndex).toBeLessThan(importIndex);

    // Write back and re-read
    await writeFile(scssPath, planSet.value.after, 'utf-8');
    const read2 = await bootstrapAdapter.read(directWriteFs, files);
    expect(read2.ok).toBe(true);
    if (!read2.ok) return;
    const primary2 = read2.value.colors.find((c) => c.name === 'primary');
    expect(primary2?.value).toBe('#2563eb');
    expect(primary2?.inherited).toBeUndefined();

    // 3. Remove primary -> returns to inherited
    const planRemove = await bootstrapAdapter.plan(directWriteFs, files, {
      op: 'remove',
      kind: 'color',
      name: 'primary',
    });
    expect(planRemove.ok).toBe(true);
    if (!planRemove.ok) return;

    await writeFile(scssPath, planRemove.value.after, 'utf-8');
    const read3 = await bootstrapAdapter.read(directWriteFs, files);
    expect(read3.ok).toBe(true);
    if (!read3.ok) return;
    const primary3 = read3.value.colors.find((c) => c.name === 'primary');
    expect(primary3?.value).toBe('#0d6efd');
    expect(primary3?.inherited).toBe(true);
  });

  it('[R-ST-11] Chế độ CSS: .btn { --bs-primary: red; } trước :root → set primary chỉ đổi trong :root', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    const cssPath = join(dir, 'src', 'index.css');
    const initialContent = [
      '.btn {',
      '  --bs-primary: red;',
      '}',
      ':root {',
      '  --bs-primary: #0d6efd;',
      '  --bs-primary-rgb: 13, 110, 253;',
      '}',
    ].join('\n');
    await writeFile(cssPath, initialContent, 'utf-8');

    const files = {
      root: dir,
      styling: {
        systems: [{ id: 'bootstrap' as const, version: '5.3.3' }],
        editable: true,
        primary: 'bootstrap' as const,
        globalCss: ['src/index.css'],
      },
      tailwindCss: undefined,
      sourceDir: 'src',
    };

    const planRes = await bootstrapAdapter.plan(directWriteFs, files, {
      op: 'set',
      kind: 'color',
      name: 'primary',
      value: '#ff0000',
    });
    expect(planRes.ok).toBe(true);
    if (!planRes.ok) return;

    expect(planRes.value.after).toContain('.btn {\n  --bs-primary: red;\n}');
    expect(planRes.value.after).toContain('--bs-primary: #ff0000;');
    expect(planRes.value.after).toContain('--bs-primary-rgb: 255, 0, 0;');
  });
});
