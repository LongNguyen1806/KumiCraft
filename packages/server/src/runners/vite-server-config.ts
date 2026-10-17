// Dev server options the runner forces on the project's Vite (S-104): loopback only, no CORS.
import type { RunnerOptions } from '@reactcraft/shared';

/** `port` undefined: Vite takes the project's own port (its vite.config, else 5173) (R-RN-04). */
export function devServerOptions(options: RunnerOptions, port: number | undefined) {
  return {
    host: options.host,
    ...(port === undefined ? {} : { port }),
    strictPort: true,
    open: false,
    // S-104: the project's pages answer only the Studio's iframe, never other sites.
    cors: false,
  } as const;
}
