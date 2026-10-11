// `pnpm dev`: the Local Backend from source (restarts on change) plus the Vite dev server of the
// Studio, which proxies /api to the backend. Works on Windows, macOS and Linux (QC-07).
import { spawn } from 'node:child_process';

const API_PORT = '4310';
const STUDIO_URL = 'http://127.0.0.1:5173';
const isWindows = process.platform === 'win32';

const children = [
  spawn(
    process.execPath,
    ['--watch', 'packages/cli/src/index.ts', '--port', API_PORT, ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, REACTCRAFT_DEV_STUDIO_URL: STUDIO_URL } },
  ),
  spawn('pnpm', ['--filter', '@reactcraft/studio', 'dev'], {
    stdio: 'inherit',
    shell: isWindows,
    env: { ...process.env, REACTCRAFT_API_PORT: API_PORT },
  }),
];

let isStopping = false;
const stopAll = (code) => {
  if (isStopping) return;
  isStopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
};

for (const child of children) {
  child.on('exit', (code) => stopAll(code ?? 0));
}
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
