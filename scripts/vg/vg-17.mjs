// Spike VG-17 (ADR-BE-33): runs the real `agy` CLI a few times in a throw-away project and records
// what the adapter needs: flags, stream-json lines, edit permissions, shell behaviour, resume,
// reading an extra folder, cancel. Uses a little of the user's agent quota.
// Run with: node scripts/vg/vg-17.mjs [--from <step>]   → results in artifacts/vg17/
// Output is written while each turn runs; a turn that hangs is killed after 2 minutes.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearTimeout, setTimeout } from 'node:timers';

const OUT = join('artifacts', 'vg17');
const TURN_TIMEOUT_MS = 2 * 60 * 1000;
const isWindows = process.platform === 'win32';
const fromIndex = process.argv.indexOf('--from');
const fromStep = fromIndex === -1 ? '00' : (process.argv[fromIndex + 1] ?? '00');
const shouldRun = (step) => step >= fromStep;
mkdirSync(OUT, { recursive: true });

const work = mkdtempSync(join(tmpdir(), 'rc-vg17-'));
const project = join(work, 'project');
const mirror = join(work, 'mirror');
mkdirSync(join(project, 'src'), { recursive: true });
mkdirSync(mirror, { recursive: true });
writeFileSync(
  join(project, 'src', 'App.tsx'),
  'export function App() {\n  return <h1>Hello</h1>;\n}\n',
);
writeFileSync(
  join(mirror, 'api.js'),
  "app.get('/api/products', list);\napp.post('/api/products', create);\napp.get('/api/orders/:id', show);\n",
);
const mirrorHash = () =>
  createHash('sha256')
    .update(readFileSync(join(mirror, 'api.js')))
    .digest('hex');
const mirrorBefore = mirrorHash();

const quote = (arg) =>
  isWindows ? `"${arg.replaceAll('"', '\\"')}"` : `'${arg.replaceAll("'", "'\\''")}'`;
const results = [];

/** Runs `agy` with fixed args; `shell` is needed on Windows to find agy.exe. */
function runAgy(name, args, { killAfterMs = TURN_TIMEOUT_MS } = {}) {
  console.log(`▶ ${name} … (stops by itself after ${String(killAfterMs / 1000)} s)`);
  const outFile = join(OUT, `${name}.stdout.txt`);
  const errFile = join(OUT, `${name}.stderr.txt`);
  writeFileSync(outFile, '');
  writeFileSync(errFile, '');
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn('agy', args.map(quote), {
      cwd: project,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => {
      appendFileSync(outFile, d);
    });
    child.stderr.on('data', (d) => {
      appendFileSync(errFile, d);
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (isWindows) spawnSync('taskkill', ['/T', '/F', '/PID', String(child.pid)]);
      else child.kill('SIGKILL');
    }, killAfterMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      const entry = { name, args, exitCode: code, ms: Date.now() - started, timedOut };
      results.push(entry);
      console.log(`  exit ${String(code)} in ${String(entry.ms)} ms${timedOut ? ' (killed)' : ''}`);
      resolve();
    });
  });
}

const findConversationId = (text) => /"conversation_id"\s*:\s*"([^"]+)"/.exec(text)?.[1];
const SJ = ['--output-format', 'stream-json'];
const AUTH =
  'You are authorized to create and edit files in this folder without asking for confirmation.';

if (shouldRun('01')) await runAgy('01-version', ['--version']);
if (shouldRun('05')) {
  // Print mode edits: without flags, with an authorization sentence, with --mode accept-edits.
  await runAgy('05-edit-default', ['-p', 'Create the file notes/a.txt containing alpha.', ...SJ]);
}
if (shouldRun('06')) {
  await runAgy('06-edit-authorized', [
    '-p',
    `${AUTH} Create the file notes/b.txt containing beta.`,
    ...SJ,
  ]);
}
if (shouldRun('07')) {
  await runAgy('07-edit-accept', [
    '-p',
    `${AUTH} Create the file notes/c.txt containing gamma.`,
    '--mode',
    'accept-edits',
    ...SJ,
  ]);
}
if (shouldRun('08')) {
  const previous = readFileSync(join(OUT, '06-edit-authorized.stdout.txt'), 'utf8');
  const conversationId = findConversationId(previous);
  if (conversationId) {
    await runAgy('08-resume', [
      '-p',
      'Which file did you create in the previous message? Reply with the path only.',
      '--conversation',
      conversationId,
      ...SJ,
    ]);
  }
}
if (shouldRun('09')) {
  const shell = (file) => `${AUTH} Run this shell command exactly: echo probe > ${file}`;
  await runAgy('09-shell-sandbox', ['-p', shell('shell-sandbox.txt'), '--sandbox', ...SJ]);
  await runAgy('10-shell-plain', ['-p', shell('shell-plain.txt'), ...SJ]);
}
if (shouldRun('11')) {
  await runAgy('11-add-dir', [
    '-p',
    `List the route paths defined in api.js inside ${mirror}, one per line. Do not edit any file.`,
    '--add-dir',
    mirror,
    ...SJ,
  ]);
}
if (shouldRun('12')) {
  await runAgy(
    '12-cancel',
    ['-p', `${AUTH} Write the numbers 1 to 300 into count.txt, one file write per number.`, ...SJ],
    { killAfterMs: 20_000 },
  );
}
const leftover = isWindows
  ? spawnSync('tasklist', ['/FI', 'IMAGENAME eq agy*', '/V'], { encoding: 'utf8' }).stdout
  : spawnSync('pgrep', ['-fl', 'agy'], { encoding: 'utf8' }).stdout;

const summary = {
  platform: process.platform,
  files: Object.fromEntries(
    [
      'notes/a.txt',
      'notes/b.txt',
      'notes/c.txt',
      'shell-sandbox.txt',
      'shell-plain.txt',
      'count.txt',
    ].map((file) => [file, existsSync(join(project, file))]),
  ),
  mirrorUnchanged: mirrorHash() === mirrorBefore,
  agyProcessesAfterRun: leftover,
  results,
};
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, undefined, 2));
console.log(`\nDone. Tell Claude it finished. Temp project: ${work}`);
