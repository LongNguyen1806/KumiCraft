// Tests for fake-agent test double and script execution (R-QA-10 to R-QA-13, S-111, S-115).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AgentEvent } from '@reactcraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createNodeProcess } from '../../adapters/system/node-process.ts';
import { agyAdapter } from './adapters/agy.ts';

const FAKE_AGENT_PATH = fileURLToPath(
  new URL('../../../test-support/fake-agent.mjs', import.meta.url),
);
const SCRIPTS_DIR = fileURLToPath(new URL('../../../test-support/agent-scripts', import.meta.url));

describe('fake-agent.mjs', () => {
  let tempDir: string;
  const proc = createNodeProcess();

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rc-fake-agent-test-'));
  });

  afterEach(() => {
    delete process.env['REACTCRAFT_TEST_SECRET'];
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('[R-QA-10] responds to --version with 0.0.0-fake and exit code 0', async () => {
    const handle = proc.spawn(process.execPath, [FAKE_AGENT_PATH, '--version'], {
      cwd: tempDir,
    });
    const res = await handle.wait();
    expect(res.exitCode).toBe(0);
    expect(res.stdout.trim()).toBe('0.0.0-fake');
  });

  it('[R-QA-10] rejects invalid flags, missing -p, and missing flag values with exit code 2', async () => {
    const run = async (args: string[]) => {
      const handle = proc.spawn(process.execPath, [FAKE_AGENT_PATH, ...args], {
        cwd: tempDir,
      });
      return handle.wait();
    };

    const resUnknown = await run([
      '-p',
      'x',
      '--output-format',
      'stream-json',
      '--mode',
      'accept-edits',
    ]);
    expect(resUnknown.exitCode).toBe(2);
    expect(resUnknown.stderr).toContain('Unknown flag');

    const resMissingPrompt = await run(['--output-format', 'stream-json']);
    expect(resMissingPrompt.exitCode).toBe(2);
    expect(resMissingPrompt.stderr).toContain('-p');

    const resMissingAddDirVal = await run([
      '-p',
      'x',
      '--output-format',
      'stream-json',
      '--add-dir',
    ]);
    expect(resMissingAddDirVal.exitCode).toBe(2);
    expect(resMissingAddDirVal.stderr).toContain('--add-dir');
  });

  it('[R-QA-11, R-QA-13] executes success-edit.json, modifies files, and produces valid agy events', async () => {
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'App.tsx'), '// initial App\n', 'utf-8');
    writeFileSync(join(tempDir, 'src', 'main.tsx'), '// initial main\n', 'utf-8');

    const scriptPath = join(SCRIPTS_DIR, 'success-edit.json');
    const handle = proc.spawn(
      process.execPath,
      [FAKE_AGENT_PATH, '-p', 'update app', '--output-format', 'stream-json'],
      {
        cwd: tempDir,
        env: { RC_FAKE_AGENT_SCRIPT: scriptPath },
      },
    );

    const events: AgentEvent[] = [];
    handle.onLine((line) => {
      const ev = agyAdapter.parseLine(line);
      if (ev !== undefined) events.push(ev);
    });

    const res = await handle.wait();
    expect(res.exitCode).toBe(0);

    const appContent = readFileSync(join(tempDir, 'src', 'App.tsx'), 'utf-8');
    const mainContent = readFileSync(join(tempDir, 'src', 'main.tsx'), 'utf-8');
    const productsPath = join(tempDir, 'src', 'pages', 'Products.tsx');
    expect(existsSync(productsPath)).toBe(true);
    const productsContent = readFileSync(productsPath, 'utf-8');

    expect(appContent).toContain('fake-agent');
    expect(mainContent).toContain('fake-agent');
    expect(productsContent).toContain('fake-agent');

    expect(events.map((e) => e.kind)).toEqual([
      'conversation',
      'message',
      'message',
      'tool',
      'tool',
      'tool',
    ]);
  });

  it('[R-QA-13] executes fail-midway.json, applies partial writes, and exits with code 1', async () => {
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'App.tsx'), '// initial App\n', 'utf-8');

    const scriptPath = join(SCRIPTS_DIR, 'fail-midway.json');
    const handle = proc.spawn(
      process.execPath,
      [FAKE_AGENT_PATH, '-p', 'failing task', '--output-format', 'stream-json'],
      {
        cwd: tempDir,
        env: { RC_FAKE_AGENT_SCRIPT: scriptPath },
      },
    );

    const events: AgentEvent[] = [];
    handle.onLine((line) => {
      const ev = agyAdapter.parseLine(line);
      if (ev !== undefined) events.push(ev);
    });

    const res = await handle.wait();
    expect(res.exitCode).toBe(1);

    const appContent = readFileSync(join(tempDir, 'src', 'App.tsx'), 'utf-8');
    expect(appContent).toContain('fake-agent');

    const errorEvent = events.find((e) => e.kind === 'error');
    expect(errorEvent).toEqual({ kind: 'error', message: 'agy: ERROR' });
  });

  it('[R-QA-13] waits for init line and kills hanging agent within 5 seconds', async () => {
    const scriptPath = join(SCRIPTS_DIR, 'hang.json');
    const handle = proc.spawn(
      process.execPath,
      [FAKE_AGENT_PATH, '-p', 'hang task', '--output-format', 'stream-json'],
      {
        cwd: tempDir,
        env: { RC_FAKE_AGENT_SCRIPT: scriptPath },
      },
    );

    await new Promise<void>((resolve) => {
      handle.onLine((line) => {
        const ev = agyAdapter.parseLine(line);
        if (ev?.kind === 'conversation') {
          resolve();
        }
      });
    });

    const startTime = Date.now();
    await handle.kill();
    const res = await handle.wait();
    const elapsedMs = Date.now() - startTime;

    expect(elapsedMs).toBeLessThan(5000);
    expect(res.exitCode).not.toBe(0);

    const pid = handle.pid;
    if (pid !== undefined) {
      expect(() => process.kill(pid, 0)).toThrow();
    }
  });

  it('[R-QA-11] rejects path outside project with exit code 3', async () => {
    const customScript = join(tempDir, 'outside-test.json');
    const outsideFile = join(tempDir, 'outside.txt');
    writeFileSync(
      customScript,
      JSON.stringify({
        steps: [{ write: { path: '../outside.txt', content: 'hacked' } }],
      }),
      'utf-8',
    );

    const handle = proc.spawn(
      process.execPath,
      [FAKE_AGENT_PATH, '-p', 'write outside', '--output-format', 'stream-json'],
      {
        cwd: tempDir,
        env: { RC_FAKE_AGENT_SCRIPT: customScript },
      },
    );

    const res = await handle.wait();
    expect(res.exitCode).toBe(3);
    expect(existsSync(outsideFile)).toBe(false);
  });

  it('[S-111, S-115, S-53] records invocation args, cwd, and sanitized env to RC_FAKE_AGENT_RECORD', async () => {
    process.env['REACTCRAFT_TEST_SECRET'] = 'secret-token-123';
    const recordFile = join(tempDir, 'record.json');
    const mirrorDir = join(tempDir, 'mirror');
    mkdirSync(mirrorDir, { recursive: true });

    const args = agyAdapter.buildArgs({
      prompt: 'Do task',
      mirrorDirs: [mirrorDir],
    });

    const handle = proc.spawn(process.execPath, [FAKE_AGENT_PATH, ...args], {
      cwd: tempDir,
      env: {
        RC_FAKE_AGENT_RECORD: recordFile,
        GH_TOKEN: 'gh_secret_token_val',
      },
    });

    const res = await handle.wait();
    expect(res.exitCode).toBe(0);
    expect(existsSync(recordFile)).toBe(true);

    const raw = readFileSync(recordFile, 'utf-8');
    const RecordSchema = z.strictObject({
      cwd: z.string(),
      argv: z.array(z.string()),
      envKeys: z.array(z.string()),
    });
    const recorded = RecordSchema.parse(JSON.parse(raw));

    expect(recorded.cwd).toBe(tempDir);
    expect(recorded.argv).toEqual(args);
    expect(recorded.envKeys).toContain('GH_TOKEN');
    expect(recorded.envKeys).not.toContain('REACTCRAFT_TEST_SECRET');
  });
});
