#!/usr/bin/env node
// Test double for agy/claude agents (WP-3.03a, R-QA-10 to R-QA-13, S-111, S-115).
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

/** Ends the run with an exit code: `main` catches it and lets Node exit once stdout is flushed. */
class Exit {
  constructor(code) {
    this.code = code;
  }
}

function terminate(code) {
  throw new Exit(code);
}

function runVersion() {
  process.stdout.write('0.0.0-fake\n');
  terminate(0);
}

function runModels() {
  if (process.env.RC_FAKE_AGENT_LOGIN === 'loggedOut') {
    process.stderr.write(
      'Error: Please sign in to view available models. Launch the CLI without arguments to sign in.\n',
    );
    terminate(1);
  }
  process.stdout.write('fake-model\n');
  terminate(0);
}

/** Flags whose value the real CLIs check; the fake refuses the same bad values. */
const CHECKED_VALUES = {
  '--model': (v) => !v.startsWith('-'),
  '--effort': (v) => ['low', 'medium', 'high', 'xhigh', 'max'].includes(v),
  '--mode': (v) => v === 'plan',
  '--permission-mode': (v) => v === 'acceptEdits' || v === 'plan',
};

function parseArgs(args) {
  let prompt;
  let outputFormat;
  const addDirs = [];
  let conversationId;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '-p') {
      if (++i >= args.length) return { ok: false, error: 'Missing value for -p' };
      prompt = next;
    } else if (arg === '--output-format') {
      if (++i >= args.length || next.startsWith('-')) {
        return { ok: false, error: 'Missing value for --output-format' };
      }
      outputFormat = next;
    } else if (arg === '--add-dir') {
      if (++i >= args.length || next.startsWith('-')) {
        return { ok: false, error: 'Missing value for --add-dir' };
      }
      addDirs.push(next);
    } else if (arg === '--conversation' || arg === '--resume') {
      if (++i >= args.length || next.startsWith('-')) {
        return { ok: false, error: `Missing value for ${arg}` };
      }
      conversationId = next;
    } else if (arg in CHECKED_VALUES) {
      if (++i >= args.length || !CHECKED_VALUES[arg](next)) {
        return { ok: false, error: `Unknown flag or unexpected argument: ${arg} ${next ?? ''}` };
      }
    } else if (arg !== '--verbose') {
      return { ok: false, error: `Unknown flag or unexpected argument: ${arg}` };
    }
  }

  if (prompt === undefined) return { ok: false, error: 'Missing required flag -p' };
  if (outputFormat !== 'stream-json') {
    return { ok: false, error: 'Missing or invalid --output-format (expected stream-json)' };
  }
  return { ok: true, prompt, outputFormat, addDirs, conversationId };
}

function recordInvocation() {
  const recordFile = process.env.RC_FAKE_AGENT_RECORD;
  if (!recordFile) return;
  const record = {
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    envKeys: Object.keys(process.env).sort(),
  };
  fs.mkdirSync(path.dirname(path.resolve(recordFile)), { recursive: true });
  fs.writeFileSync(recordFile, JSON.stringify(record, undefined, 2), 'utf-8');
}

function replaceConversation(val, convId) {
  if (typeof val === 'string') {
    return val.replaceAll('$CONVERSATION', convId);
  }
  if (Array.isArray(val)) {
    return val.map((item) => replaceConversation(item, convId));
  }
  if (val !== undefined && typeof val === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = replaceConversation(v, convId);
    }
    return res;
  }
  return val;
}

function isOutsideProject(cwd, targetPath) {
  if (path.isAbsolute(targetPath)) return true;
  const parts = targetPath.split(/[/\\]/);
  if (parts.includes('..')) return true;
  const full = path.resolve(cwd, targetPath);
  const rel = path.relative(cwd, full);
  return rel.startsWith('..') || path.isAbsolute(rel);
}

function executeWrite(step) {
  const targetPath = step.write?.path ?? '';
  if (isOutsideProject(process.cwd(), targetPath)) {
    process.stderr.write(`Path outside project not allowed: ${targetPath}\n`);
    terminate(3);
  }
  const full = path.resolve(process.cwd(), targetPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, step.write.content ?? '', 'utf-8');
}

function executeRead(step, addDirs) {
  const target = step.read;
  if (typeof target !== 'string') return;
  const candidates = [process.cwd(), ...addDirs];
  for (const base of candidates) {
    const full = path.resolve(base, target);
    if (fs.existsSync(full)) {
      try {
        fs.readFileSync(full);
      } catch {
        // ignore
      }
      break;
    }
  }
}

async function runStep(step, convId, addDirs) {
  if (step.emit !== undefined) {
    const resolved = replaceConversation(step.emit, convId);
    process.stdout.write(JSON.stringify(resolved) + '\n');
  }
  if (step.write !== undefined) {
    executeWrite(step);
  }
  if (step.read !== undefined) {
    executeRead(step, addDirs);
  }
  if (step.stderr !== undefined) {
    process.stderr.write(String(step.stderr) + '\n');
  }
  if (typeof step.wait === 'number' && step.wait > 0) {
    await sleep(step.wait);
  }
  if (typeof step.exit === 'number') {
    terminate(step.exit);
  }
}

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 1 && rawArgs[0] === '--version') {
    runVersion();
  }
  if (rawArgs.length === 1 && rawArgs[0] === 'models') {
    runModels();
  }

  const parsed = parseArgs(rawArgs);
  if (!parsed.ok) {
    process.stderr.write(`Invalid arguments: ${parsed.error}\n`);
    terminate(2);
  }

  recordInvocation();

  const convId = parsed.conversationId ?? 'fake-conv-1';
  const scriptPath = process.env.RC_FAKE_AGENT_SCRIPT;

  if (!scriptPath) {
    process.stdout.write(JSON.stringify({ event: 'init', conversation_id: convId }) + '\n');
    process.stdout.write(JSON.stringify({ event: 'result', result: { status: 'SUCCESS' } }) + '\n');
    terminate(0);
  }

  const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
  const script = JSON.parse(scriptContent);
  const steps = script.steps ?? [];

  for (const step of steps) {
    await runStep(step, convId, parsed.addDirs);
  }

  terminate(0);
}

main().catch((err) => {
  if (err instanceof Exit) {
    process.exitCode = err.code;
    return;
  }
  process.stderr.write(String(err) + '\n');
  process.exitCode = 1;
});
