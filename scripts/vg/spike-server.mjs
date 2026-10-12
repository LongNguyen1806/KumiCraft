// Builds and serves the spike pages of packages/studio/spikes for scripts/vg/vg-11.mjs and vg-14.mjs.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const SPIKES = join(import.meta.dirname, '..', '..', 'packages', 'studio', 'spikes');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

/** Builds the spike pages with the Studio's own Vite and React. */
export function buildSpikes() {
  const built = spawnSync(
    'pnpm',
    [
      '--filter',
      '@reactcraft/studio',
      'exec',
      'vite',
      'build',
      '--config',
      'spikes/vite.config.ts',
    ],
    { stdio: 'inherit', shell: true },
  );
  if (built.status !== 0) throw new Error('spike build failed');
}

/** Serves spikes/dist on a free port of 127.0.0.1. */
export function serveSpikes() {
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://x').pathname;
    try {
      const body = readFileSync(join(SPIKES, 'dist', decodeURIComponent(path)));
      response.writeHead(200, {
        'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, origin: `http://127.0.0.1:${String(server.address().port)}` });
    });
  });
}
