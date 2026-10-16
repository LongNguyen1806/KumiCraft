// Dev server options the runner forces on the project's Vite (S-104): loopback only, no CORS.
import type { RunnerOptions } from '@reactcraft/shared';

export function devServerOptions(options: RunnerOptions) {
  return {
    host: options.host,
    port: options.port,
    strictPort: true,
    open: false,
    // S-104: the project's pages answer only the Studio's iframe, never other sites.
    cors: false,
  } as const;
}
