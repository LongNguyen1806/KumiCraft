// Smoke test of the installed command (`pnpm package`, then `npm install -g artifacts/*.tgz`): runs
// `kumicraft` the way a developer would on Windows, macOS or Linux, waits for the Studio address
// and checks that the Studio page is served. Exits 1 on failure.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearTimeout, setTimeout } from 'node:timers';

const TIMEOUT_MS = 30_000;
const workspace = mkdtempSync(join(tmpdir(), 'kumicraft-smoke-'));
const configDir = mkdtempSync(join(tmpdir(), 'kumicraft-smoke-config-'));
// `shell: true` finds `kumicraft.cmd` on Windows and the `kumicraft` link elsewhere.
const child = spawn('kumicraft', [JSON.stringify(workspace), '--no-open', '--log-level', 'warn'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
  // Keeps the machine's own KumiCraft settings untouched.
  env: { ...process.env, KUMICRAFT_CONFIG_DIR: configDir },
});

let output = '';
const finish = (code, message) => {
  console.log(message);
  child.kill();
  rmSync(workspace, { recursive: true, force: true });
  rmSync(configDir, { recursive: true, force: true });
  process.exit(code);
};

const timer = setTimeout(() => {
  finish(1, `smoke: no Studio address after ${String(TIMEOUT_MS)} ms\n${output}`);
}, TIMEOUT_MS);

const check = async (studioUrl) => {
  clearTimeout(timer);
  try {
    const response = await globalThis.fetch(`${new URL(studioUrl).origin}/`);
    const html = await response.text();
    const ok = response.status === 200 && html.includes('<div id="root">');
    finish(
      ok ? 0 : 1,
      ok ? `smoke: Studio served at ${studioUrl}` : `smoke: bad page ${String(response.status)}`,
    );
  } catch (error) {
    finish(1, `smoke: ${String(error)}`);
  }
};

const collect = (chunk) => {
  output += chunk.toString();
  const studioUrl = /Studio: (\S+)/.exec(output)?.[1];
  if (studioUrl !== undefined) void check(studioUrl);
};
child.stdout.on('data', collect);
child.stderr.on('data', collect);
child.on('exit', (code) => {
  if (!output.includes('Studio: '))
    finish(1, `smoke: kumicraft exited with ${String(code)}\n${output}`);
});
