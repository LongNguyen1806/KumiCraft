// The owner's report of 2026-11-18: turning "Hiện dần khi cuộn tới" on lost the selection. The
// wrap moves the element a line down and an indent in, so each result says where it is now.
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../../workspace/test-support.ts';
import { applyRevealEdit } from './reveal-service.ts';

const PAGE = 'src/App.tsx';
const CODE = [
  'export function App() {',
  '  return (',
  '    <main>',
  '      <h2>Title</h2>',
  '    </main>',
  '  );',
  '}',
  '',
].join('\n');

describe('the element after a Reveal wrap or unwrap [R-SE-04]', () => {
  let tmpDir = '';

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kc-reveal-loc-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, PAGE), CODE, 'utf8');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /** The text that starts at `loc`, so the test reads what the loc points at. */
  const textAt = async (loc: string | undefined) => {
    const [, line = '0', col = '0'] = /:(\d+):(\d+)$/.exec(loc ?? '') ?? [];
    const code = await fs.readFile(path.join(tmpDir, PAGE), 'utf8');
    return (code.split('\n')[Number(line) - 1] ?? '').slice(Number(col) - 1);
  };
  const reveal = async (request: Parameters<typeof applyRevealEdit>[2]) => {
    const res = await applyRevealEdit({ fs: nodeFs }, tmpDir, request);
    if (!res.ok) throw new Error(res.error.code);
    return res.value;
  };

  it('points at the element after wrap, a props change, and unwrap', async () => {
    const wrapped = await reveal({ action: 'wrap', loc: `${PAGE}:4:7`, tag: 'h2', effect: 'fade' });
    expect(wrapped.loc).not.toBe(`${PAGE}:4:7`);
    expect(await textAt(wrapped.loc)).toMatch(/^<h2>Title/);

    const zoomed = await reveal({
      action: 'wrap',
      loc: wrapped.loc ?? '',
      tag: 'h2',
      effect: 'zoom',
    });
    expect(await textAt(zoomed.loc)).toMatch(/^<h2>Title/);

    const unwrapped = await reveal({ action: 'unwrap', loc: zoomed.loc ?? '', tag: 'h2' });
    expect(unwrapped.loc).toBe(`${PAGE}:4:7`);
    expect(await fs.readFile(path.join(tmpDir, PAGE), 'utf8')).toBe(CODE);
  });

  it('gives no loc for a component use, which has no element of its own', async () => {
    await fs.writeFile(path.join(tmpDir, PAGE), CODE.replace('<h2>Title</h2>', '<Card />'), 'utf8');
    const res = await reveal({ action: 'wrap', loc: `${PAGE}:4:7`, tag: 'Card', effect: 'fade' });
    expect(res.loc).toBeUndefined();
  });
});
