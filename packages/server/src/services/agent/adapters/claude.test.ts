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

describe('claudeAdapter model, effort and usage [K9.5]', () => {
  it('passes the picked model and effort to the CLI', () => {
    const args = claudeAdapter.buildArgs({
      prompt: 'Hi',
      mirrorDirs: [],
      allowEdits: true,
      model: 'sonnet',
      effort: 'high',
    });
    expect(args.slice(-4)).toEqual(['--model', 'sonnet', '--effort', 'high']);
  });

  it('reads the five-hour and weekly windows from rate_limit_event', () => {
    const line = JSON.stringify({
      type: 'rate_limit_event',
      rate_limit_info: {
        unifiedWindows: {
          five_hour: { utilization: 0.42, resetsAt: 1_794_000_000 },
          seven_day: { utilization: 1.3 },
        },
      },
    });
    expect(claudeAdapter.parseLine(line)).toEqual({
      kind: 'usage',
      usage: {
        fiveHour: { used: 0.42, resetsAt: new Date(1_794_000_000 * 1000).toISOString() },
        week: { used: 1 },
      },
    });
  });

  it('reads model, tokens, cost and context window from the result', () => {
    const line = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      total_cost_usd: 0.12,
      modelUsage: {
        'claude-sonnet-5-5': {
          inputTokens: 10,
          outputTokens: 20,
          cacheReadInputTokens: 300,
          cacheCreationInputTokens: 0,
          contextWindow: 200_000,
        },
      },
    });
    expect(claudeAdapter.parseLine(line)).toEqual({
      kind: 'usage',
      usage: { model: 'claude-sonnet-5-5', tokens: 330, costUsd: 0.12, contextWindow: 200_000 },
    });
  });

  it('offers the model aliases Claude Code takes', () => {
    expect(claudeAdapter.models).toEqual([
      { id: 'fable', label: 'Fable' },
      { id: 'opus', label: 'Opus' },
      { id: 'sonnet', label: 'Sonnet' },
      { id: 'haiku', label: 'Haiku' },
    ]);
  });
});
