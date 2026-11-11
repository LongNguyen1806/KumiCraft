import { EventEmitter } from 'node:events';

import { describe, expect, it } from 'vitest';

import { describeCrash, installCrashGuard } from './crash-guard.ts';

describe('installCrashGuard (spec-log #116)', () => {
  it('writes an unhandled rejection and an uncaught error to the terminal instead of exiting', () => {
    const target = new EventEmitter();
    const lines: string[] = [];
    installCrashGuard(target, (line) => lines.push(line));

    target.emit('unhandledRejection', new Error('watcher closed'));
    target.emit('uncaughtException', 'plain text');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('keeps running');
    expect(lines[0]).toContain('watcher closed');
    expect(lines[1]).toContain('plain text');
  });

  it('prints the stack of an Error and the text of anything else', () => {
    expect(describeCrash(new Error('boom'))).toContain('boom');
    expect(describeCrash(42)).toBe('42');
  });
});
