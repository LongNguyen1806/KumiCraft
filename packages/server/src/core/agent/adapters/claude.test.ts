// Tests for claude adapter (WP-3.03a, S-112).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { AgentEvent } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import { claudeAdapter } from './claude.ts';

const FORBIDDEN_FLAGS = [
  '--dangerously-skip-permissions',
  'bypassPermissions',
  '--allowedTools',
  '--continue',
];

describe('claudeAdapter', () => {
  it('[VG-17] reads the login state from `claude auth status` without spending a turn', () => {
    const probe = claudeAdapter.loginProbe;
    expect(probe?.args).toEqual(['auth', 'status']);
    const out = (stdout: string, exitCode = 0) => ({ exitCode, stdout, stderr: '', lines: [] });
    expect(probe?.classify(out('{"loggedIn": true, "authMethod": "claude.ai"}'))).toBe('loggedIn');
    expect(probe?.classify(out('{"loggedIn": false}', 1))).toBe('loggedOut');
    // An older Claude Code without the command prints help or an error: stay unknown.
    expect(probe?.classify(out('error: unknown command auth', 1))).toBe('unknown');
  });

  it('[S-112] buildArgs produces expected arguments without widening permissions and parses sample lines', () => {
    const withoutConv = claudeAdapter.buildArgs({
      prompt: 'Refactor code',
      mirrorDirs: ['dir1'],
      allowEdits: true,
    });

    expect(withoutConv).toEqual([
      '-p',
      'Refactor code',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'acceptEdits',
      '--add-dir',
      'dir1',
    ]);

    const withConv = claudeAdapter.buildArgs({
      prompt: 'Refactor code',
      mirrorDirs: ['dir1'],
      allowEdits: true,
      conversationId: 'sess-abc',
    });

    expect(withConv).toEqual([
      '-p',
      'Refactor code',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'acceptEdits',
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

  it('E1 [WP-4.00]: claude buildArgs uses --permission-mode acceptEdits when allowEdits is true and plan when false, with no forbidden flags', () => {
    const editArgs = claudeAdapter.buildArgs({
      prompt: 'Edit file',
      mirrorDirs: [],
      allowEdits: true,
    });
    const planArgs = claudeAdapter.buildArgs({
      prompt: 'Explain file',
      mirrorDirs: [],
      allowEdits: false,
    });

    expect(editArgs).toEqual([
      '-p',
      'Edit file',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'acceptEdits',
    ]);
    expect(planArgs).toEqual([
      '-p',
      'Explain file',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'plan',
    ]);

    for (const flag of FORBIDDEN_FLAGS) {
      expect(editArgs).not.toContain(flag);
      expect(planArgs).not.toContain(flag);
    }
  });
});
