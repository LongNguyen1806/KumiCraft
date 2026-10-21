// Tests for claude adapter (WP-3.03a, S-112).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { AgentEvent } from '@reactcraft/shared';
import { describe, expect, it } from 'vitest';

import { claudeAdapter } from './claude.ts';

const FORBIDDEN_FLAGS = [
  '--dangerously-skip-permissions',
  '--permission-mode',
  '--allowedTools',
  '--continue',
];

describe('claudeAdapter', () => {
  it('[S-112] buildArgs produces expected arguments without widening permissions and parses sample lines', () => {
    const withoutConv = claudeAdapter.buildArgs({
      prompt: 'Refactor code',
      mirrorDirs: ['dir1'],
    });

    expect(withoutConv).toEqual([
      '-p',
      'Refactor code',
      '--output-format',
      'stream-json',
      '--verbose',
      '--add-dir',
      'dir1',
    ]);

    const withConv = claudeAdapter.buildArgs({
      prompt: 'Refactor code',
      mirrorDirs: ['dir1'],
      conversationId: 'sess-abc',
    });

    expect(withConv).toEqual([
      '-p',
      'Refactor code',
      '--output-format',
      'stream-json',
      '--verbose',
      '--add-dir',
      'dir1',
      '--resume',
      'sess-abc',
    ]);

    for (const flag of FORBIDDEN_FLAGS) {
      expect(withoutConv).not.toContain(flag);
      expect(withConv).not.toContain(flag);
    }

    const fixturePath = fileURLToPath(new URL('./fixtures/claude-sample.jsonl', import.meta.url));
    const lines = readFileSync(fixturePath, 'utf-8').trim().split('\n');
    expect(lines.length).toBe(5);

    const parsed: (AgentEvent | undefined)[] = lines.map((line) => claudeAdapter.parseLine(line));

    expect(parsed[0]).toEqual({
      kind: 'conversation',
      id: 'sess-123',
    });
    expect(parsed[1]).toEqual({
      kind: 'message',
      text: 'I will read the API.',
    });
    expect(parsed[2]).toEqual({
      kind: 'tool',
      name: 'Read',
      target: 'C:\\work\\mirror\\api.js',
    });
    expect(parsed[3]).toBeUndefined();
    expect(parsed[4]).toEqual({
      kind: 'error',
      message: 'claude: Reached max turns',
    });
  });
});
