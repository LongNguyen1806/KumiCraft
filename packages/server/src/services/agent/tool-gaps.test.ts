// Tool gaps reported by external AI agents (R-AG-20, round 7a).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ToolGap } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir, nodeFs, silentLogger } from '../workspace/test-support.ts';
import { createToolGapStore, MAX_TOOL_GAPS, TOOL_GAPS_FILE } from './tool-gaps.ts';
import { TOOL_GAPS_MD_FILE } from './tool-gaps-markdown.ts';

let dir: string;
let cleanup: () => Promise<void>;
let clock: number;
const store = () =>
  createToolGapStore({ fs: nodeFs, logger: silentLogger, now: () => new Date(clock) });

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
  clock = Date.parse('2026-10-23T10:00:00.000Z');
});

afterEach(async () => {
  await cleanup();
});

const report = (need: string, why = 'needed it') => ({ need, why, example: 'set color red' });

describe('tool gap store [R-AG-20]', () => {
  it('writes a Markdown copy, most reported first, with a fence the example cannot close [R-AG-20]', async () => {
    const gaps = store();
    await gaps.report(dir, { need: 'Set id', why: 'anchors', example: '' });
    await gaps.report(dir, { need: 'Svg icon', why: 'icons', example: 'a ``` b' });
    await gaps.report(dir, { need: 'svg icon', why: 'icons again', example: 'a ``` b' });

    const md = await readFile(join(dir, TOOL_GAPS_MD_FILE), 'utf8');
    expect(md.startsWith('# KumiCraft tool gaps\n')).toBe(true);
    expect(md.indexOf('## Svg icon (×2)')).toBeLessThan(md.indexOf('## Set id (×1)'));
    expect(md).toContain('**Why:** icons again');
    expect(md).toContain('````\na ``` b\n````');
    // An empty example adds no Example heading.
    expect(md.split('**Example:**')).toHaveLength(2);
  });

  it('merges reports of the same need whatever its case or spaces [R-AG-20]', async () => {
    const gaps = store();
    await gaps.report(dir, report('Set text color'));
    clock += 60_000;
    const second = await gaps.report(dir, report('  set TEXT color ', 'still missing'));

    expect(second.ok && second.value).toMatchObject({ need: 'Set text color', count: 2 });
    const listed = await gaps.list(dir);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ why: 'still missing', lastAt: '2026-10-23T10:01:00.000Z' });
  });

  it('lists the most reported first, then the most recent [R-AG-20]', async () => {
    const gaps = store();
    await gaps.report(dir, report('a'));
    clock += 1000;
    await gaps.report(dir, report('b'));
    clock += 1000;
    await gaps.report(dir, report('c'));
    await gaps.report(dir, report('a'));

    expect((await gaps.list(dir)).map((gap) => gap.need)).toEqual(['a', 'c', 'b']);
  });

  it('keeps 500 entries and drops the one seen longest ago [R-AG-20]', async () => {
    const old: ToolGap[] = Array.from({ length: MAX_TOOL_GAPS }, (_, i) => ({
      need: `need ${String(i)}`,
      why: '',
      example: '',
      count: 1,
      lastAt: new Date(Date.parse('2026-01-01T00:00:00.000Z') + i * 1000).toISOString(),
    }));
    await mkdir(join(dir, '.kumicraft'), { recursive: true });
    await writeFile(join(dir, TOOL_GAPS_FILE), JSON.stringify({ version: 1, gaps: old }));

    await store().report(dir, report('brand new'));

    const listed = await store().list(dir);
    expect(listed).toHaveLength(MAX_TOOL_GAPS);
    expect(listed.some((gap) => gap.need === 'need 0')).toBe(false);
    expect(listed.some((gap) => gap.need === 'brand new')).toBe(true);
  });

  it('treats a broken file as empty and writes a good one next time [R-AG-20]', async () => {
    await mkdir(join(dir, '.kumicraft'), { recursive: true });
    await writeFile(join(dir, TOOL_GAPS_FILE), '{ not json');

    expect(await store().list(dir)).toEqual([]);
    await store().report(dir, report('x'));
    const saved: unknown = JSON.parse(await readFile(join(dir, TOOL_GAPS_FILE), 'utf8'));
    expect(saved).toMatchObject({ version: 1, gaps: [{ need: 'x', count: 1 }] });
  });

  it('counts every report when agents report at the same time [R-AG-20]', async () => {
    const gaps = store();
    await Promise.all(Array.from({ length: 5 }, () => gaps.report(dir, report('same'))));

    expect((await gaps.list(dir))[0]?.count).toBe(5);
  });
});
