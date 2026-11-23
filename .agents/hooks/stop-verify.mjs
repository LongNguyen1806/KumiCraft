// Stop lifecycle hook for KumiCraft: runs fast architecture (lint:deps) and i18n checks
// only when relevant source files changed in the working tree.
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';

const MAX_LOG_CHARS = 1500;
const IS_WIN = process.platform === 'win32';

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw === '') return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function listChangedFiles(cwd) {
  const res = spawnSync('git', ['status', '--porcelain'], {
    cwd,
    encoding: 'utf8',
  });
  if (res.status !== 0 || typeof res.stdout !== 'string') return [];
  return res.stdout
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter((file) => file !== '')
    .map((file) => (file.includes(' -> ') ? file.split(' -> ').at(-1) : file))
    .filter((file) => typeof file === 'string');
}

function runPnpmScript(cwd, scriptName) {
  const res = spawnSync('pnpm', ['run', scriptName], {
    cwd,
    encoding: 'utf8',
    shell: IS_WIN,
  });
  if (res.status === 0) return undefined;
  const output = `${res.stdout ?? ''}\n${res.stderr ?? ''}`.trim();
  return `[pnpm run ${scriptName} failed]\n${output.slice(0, MAX_LOG_CHARS)}`;
}

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

async function main() {
  const input = await readStdinJson();
  if (
    input.terminationReason !== 'NO_TOOL_CALL' ||
    input.fullyIdle === false ||
    input.continuationActive === true
  ) {
    emit({ decision: 'allow' });
    return;
  }

  const cwd = typeof input.cwd === 'string' && input.cwd !== '' ? input.cwd : process.cwd();
  const changed = listChangedFiles(cwd);
  if (changed.length === 0) {
    emit({ decision: 'allow' });
    return;
  }

  const needsDepsCheck = changed.some(
    (f) =>
      /^packages\/(server|studio)\/src\/.+\.(ts|tsx)$/.test(f) &&
      !f.endsWith('.test.ts') &&
      !f.endsWith('.test.tsx'),
  );
  const needsI18nCheck = changed.some((f) => f.startsWith('packages/studio/src/i18n/'));

  const failures = [];
  if (needsDepsCheck) {
    const err = runPnpmScript(cwd, 'lint:deps');
    if (err !== undefined) failures.push(err);
  }
  if (needsI18nCheck) {
    const err = runPnpmScript(cwd, 'check:i18n');
    if (err !== undefined) failures.push(err);
  }

  if (failures.length > 0) {
    emit({
      decision: 'continue',
      reason: `Stop hook detected KumiCraft check failures. Fix them before finishing:\n\n${failures.join('\n\n')}`,
    });
    return;
  }

  emit({ decision: 'allow' });
}

await main();
