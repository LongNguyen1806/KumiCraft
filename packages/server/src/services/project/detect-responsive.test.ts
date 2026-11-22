import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir, nodeFs } from '../workspace/test-support.ts';
import { detectResponsiveMode } from './detect-responsive.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('detectResponsiveMode [R-PJ-09]', () => {
  it('picks desktop-first when max- variants win, mobile-first otherwise [R-PJ-09]', async () => {
    const desktopProj = join(dir, 'desktop');
    await mkdir(join(desktopProj, 'src'), { recursive: true });
    await writeFile(
      join(desktopProj, 'src', 'A.tsx'),
      '<div className="p-4 max-md:p-2 max-sm:p-1 md:p-3" />',
    );
    expect(await detectResponsiveMode(nodeFs, desktopProj, 'src')).toBe('desktop-first');

    const mobileProj = join(dir, 'mobile');
    await mkdir(join(mobileProj, 'src'), { recursive: true });
    await writeFile(
      join(mobileProj, 'src', 'B.tsx'),
      '<div className="p-1 md:p-2 lg:p-3 max-sm:p-0" />',
    );
    expect(await detectResponsiveMode(nodeFs, mobileProj, 'src')).toBe('mobile-first');
  });
});
