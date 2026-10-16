// Cross-platform runner for E2E network tests (Gate G1, SPEC-07 3.2, SL-05).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cliPath = require.resolve('@playwright/test/cli');
const extraArgs = process.argv.slice(2);
const args = [cliPath, 'test', '--workers=1', ...extraArgs];

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    RC_E2E_NETWORK: '1',
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
