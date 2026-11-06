// PB-03 (K9 C6): `setClassName` and `setText` on a 2,000-line file, written and read back from
// disk, each within 100 ms (`pnpm bench`). The file is made at run time, not kept in fixtures/.
import { expect, test } from 'vitest';

import { makeTempDir, nodeFs } from '../workspace/test-support.ts';
import { createSourceEditorService } from './source-editor-service.ts';

const BUDGET_MS = 100;
const ROUNDS = 30;
const BLOCKS = 400;

/** 400 blocks of 5 lines: 2,000 lines plus the component wrapper. */
function largeComponent(): string {
  const blocks = Array.from(
    { length: BLOCKS },
    (_, i) =>
      `      <section className="p-4 border">\n        <h2 className="text-lg">Title ${String(i)}</h2>\n        <p>Body ${String(i)}</p>\n      </section>\n      {/* ${String(i)} */}`,
  );
  return `export function Large() {\n  return (\n    <main>\n${blocks.join('\n')}\n    </main>\n  );\n}\n`;
}

function p95(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

test('PB-03: setClassName and setText on a 2,000-line file stay within 100 ms', async () => {
  const { dir: root, cleanup } = await makeTempDir();
  try {
    const source = largeComponent();
    expect(source.split('\n').length).toBeGreaterThanOrEqual(2000);
    expect((await nodeFs.mkdir(root, 'src')).ok).toBe(true);
    expect((await nodeFs.writeTextAtomic(root, 'src/Large.tsx', source)).ok).toBe(true);
    const service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
    // The middle block, so the edit is not at the start of the file.
    const line = 4 + 5 * (BLOCKS / 2);
    const classTimes: number[] = [];
    const textTimes: number[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      const even = round % 2 === 0;
      let started = performance.now();
      const cls = await service.applyEdit(root, {
        kind: 'setClassName',
        loc: `src/Large.tsx:${String(line)}:7`,
        tag: 'section',
        before: even ? 'p-4 border' : 'p-6 border',
        after: even ? 'p-6 border' : 'p-4 border',
      });
      classTimes.push(performance.now() - started);
      expect(cls.ok).toBe(true);
      started = performance.now();
      const txt = await service.applyEdit(root, {
        kind: 'setText',
        loc: `src/Large.tsx:${String(line + 2)}:9`,
        tag: 'p',
        before: even ? `Body ${String(BLOCKS / 2)}` : 'Edited',
        after: even ? 'Edited' : `Body ${String(BLOCKS / 2)}`,
      });
      textTimes.push(performance.now() - started);
      expect(txt.ok).toBe(true);
    }
    const result = { setClassName: p95(classTimes), setText: p95(textTimes) };
    process.stdout.write(`PB-03 p95 ms: ${JSON.stringify(result)}\n`);
    expect(result.setClassName).toBeLessThanOrEqual(BUDGET_MS);
    expect(result.setText).toBeLessThanOrEqual(BUDGET_MS);
  } finally {
    await cleanup();
  }
});
