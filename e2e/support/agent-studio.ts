// Starts the Local Server like the built CLI does, but with the agents pointed at `fake-agent.mjs`
// through the server's test option (R-QA-12): never through an env var a user could set. The
// Studio, the runner and the template are the built ones of `packages/cli/dist`.
// Usage: node agent-studio.ts <workspace> <configDir> <cacheDir> <dataDir>
import { createServer } from 'node:net';
import { join } from 'node:path';

import { startServer } from '../../packages/server/src/index.ts';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const CLI_DIST = join(REPO_ROOT, 'packages', 'cli', 'dist');
const FAKE_AGENT = join(REPO_ROOT, 'packages', 'server', 'test-support', 'fake-agent.mjs');

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'string' ? 0 : (address?.port ?? 0);
      probe.close(() => {
        resolve(port);
      });
    });
  });
}

const [workspaceDir, configDir, cacheDir, dataDir] = process.argv.slice(2);
if (
  workspaceDir === undefined ||
  configDir === undefined ||
  cacheDir === undefined ||
  dataDir === undefined
) {
  console.error('usage: agent-studio.ts <workspace> <configDir> <cacheDir> <dataDir>');
  process.exit(2);
}

const result = await startServer({
  version: '0.0.0-e2e',
  port: await freePort(),
  workspaceDir,
  studioDir: join(CLI_DIST, 'studio'),
  logLevel: 'warn',
  deps: {
    configDir,
    cacheDir,
    dataDir,
    templateDir: join(CLI_DIST, 'templates', 'vite-react-ts-tailwind4'),
    runnerScriptPath: join(CLI_DIST, 'runners', 'vite-react.js'),
    agentCommands: { agy: { command: process.execPath, prefixArgs: [FAKE_AGENT] } },
  },
});
if (!result.ok) {
  console.error(`agent-studio: ${JSON.stringify(result.error)}`);
  process.exit(1);
}
const server = result.value;
console.log(`Studio: ${server.url}/#t=${server.sessionToken}`);

const stop = () => {
  void server.close().finally(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
