// Tests for agy adapter (WP-3.03a, S-111, S-112).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { AgentEvent } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import { agyAdapter } from './agy.ts';

const FORBIDDEN_FLAGS = [
  '--dangerously-skip-permissions',
  '--sandbox',
  '--continue',
  '-c',
  '--prompt-interactive',
  '-i',
  '--remote-control',
];

describe('agyAdapter', () => {
  it('[S-111, S-112] buildArgs produces expected arguments in order without widening permissions', () => {
    const withoutConv = agyAdapter.buildArgs({
      prompt: 'Tạo trang',
      mirrorDirs: ['dir1', 'dir2'],
      allowEdits: true,
    });

    expect(withoutConv).toEqual([
      '-p',
      'Tạo trang',
      '--output-format',
      'stream-json',
      '--add-dir',
      'dir1',
      '--add-dir',
      'dir2',
    ]);

    const withConv = agyAdapter.buildArgs({
      prompt: 'Tạo trang',
      mirrorDirs: ['dir1', 'dir2'],
      allowEdits: true,
      conversationId: 'c-1',
    });

    expect(withConv).toEqual([
      '-p',
      'Tạo trang',
      '--output-format',
      'stream-json',
      '--add-dir',
      'dir1',
      '--add-dir',
      'dir2',
      '--conversation',
      'c-1',
    ]);

    for (const flag of [...FORBIDDEN_FLAGS, '--mode']) {
      expect(withoutConv).not.toContain(flag);
      expect(withConv).not.toContain(flag);
    }
  });

  it('E2 [WP-4.00]: agy buildArgs omits --mode when allowEdits is true and adds --mode plan when false, forbidding --mode auto', () => {
    const allowArgs = agyAdapter.buildArgs({
      prompt: 'Sửa nút',
      mirrorDirs: ['dir1'],
      allowEdits: true,
    });
    const planArgs = agyAdapter.buildArgs({
      prompt: 'Giải thích nút',
      mirrorDirs: ['dir1'],
      allowEdits: false,
    });

    expect(allowArgs).not.toContain('--mode');
    expect(planArgs).toEqual([
      '-p',
      'Giải thích nút',
      '--output-format',
      'stream-json',
      '--mode',
      'plan',
      '--add-dir',
      'dir1',
    ]);
    expect(planArgs).not.toContain('auto');
    for (const flag of FORBIDDEN_FLAGS) {
      expect(allowArgs).not.toContain(flag);
      expect(planArgs).not.toContain(flag);
    }
  });

  it('parses every line of real agy fixture agy-11-add-dir.jsonl', () => {
    const fixturePath = fileURLToPath(new URL('./fixtures/agy-11-add-dir.jsonl', import.meta.url));
    const content = readFileSync(fixturePath, 'utf-8');
    const lines = content.split('\n');

    const events: AgentEvent[] = [];
    for (const line of lines) {
      const ev = agyAdapter.parseLine(line);
      if (ev !== undefined) events.push(ev);
    }

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toEqual({
      kind: 'conversation',
      id: 'cf1d6f30-5286-449d-8cd7-d10571136c00',
    });

    const tools = events.filter((e) => e.kind === 'tool');
    expect(tools.length).toBe(1);
    expect(tools[0]?.name).toBe('read_file');
    expect(tools[0]?.target?.endsWith('api.js')).toBe(true);

    const messages = events.flatMap((e) => (e.kind === 'message' ? [e.text] : [])).join('');
    expect(messages).toContain('/api/products');

    const errors = events.filter((e) => e.kind === 'error');
    expect(errors.length).toBe(0);
  });

  it('parses real agy fixture agy-13-approve.jsonl', () => {
    const fixturePath = fileURLToPath(new URL('./fixtures/agy-13-approve.jsonl', import.meta.url));
    const content = readFileSync(fixturePath, 'utf-8');
    const lines = content.split('\n');

    const events: AgentEvent[] = [];
    for (const line of lines) {
      const ev = agyAdapter.parseLine(line);
      if (ev !== undefined) events.push(ev);
    }

    const tools = events.filter((e) => e.kind === 'tool');
    expect(tools.length).toBe(1);
    expect(tools[0]?.name).toBe('write_file');
    expect(tools[0]?.target?.endsWith('b.txt')).toBe(true);

    const errors = events.filter((e) => e.kind === 'error');
    expect(errors.length).toBe(0);
  });

  it('parses various non-event and error lines correctly', () => {
    expect(agyAdapter.parseLine('')).toBeUndefined();
    expect(agyAdapter.parseLine('not json')).toBeUndefined();
    expect(agyAdapter.parseLine('{}')).toBeUndefined();
    expect(
      agyAdapter.parseLine(
        JSON.stringify({
          event: 'step_update',
          step_update: { step_type: 'user_input' },
        }),
      ),
    ).toBeUndefined();
    expect(
      agyAdapter.parseLine(
        JSON.stringify({
          event: 'result',
          result: { status: 'SUCCESS' },
        }),
      ),
    ).toBeUndefined();

    expect(
      agyAdapter.parseLine(
        JSON.stringify({
          event: 'result',
          result: { status: 'ERROR' },
        }),
      ),
    ).toEqual({ kind: 'error', message: 'agy: ERROR' });
  });
});
