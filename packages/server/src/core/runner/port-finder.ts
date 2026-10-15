// Port selection for runner dev server (SPEC-04 R-RN-04).
import type { SystemPort } from '../ports/system-port.ts';

export const RUNNER_PORT_MIN = 49152;
export const RUNNER_PORT_MAX = 65535;

/**
 * Finds an available port on 127.0.0.1 within the dynamic range 49152–65535 (R-RN-04).
 * If a preferred port is provided and not in use, it is reused.
 */
export async function findRunnerPort(
  system: Pick<SystemPort, 'isListening'>,
  preferredPort?: number,
): Promise<number | undefined> {
  if (
    preferredPort !== undefined &&
    preferredPort >= RUNNER_PORT_MIN &&
    preferredPort <= RUNNER_PORT_MAX
  ) {
    const inUse = await system.isListening(preferredPort);
    if (!inUse) {
      return preferredPort;
    }
  }

  const maxAttempts = 50;
  for (let i = 0; i < maxAttempts; i++) {
    const candidate =
      Math.floor(Math.random() * (RUNNER_PORT_MAX - RUNNER_PORT_MIN + 1)) + RUNNER_PORT_MIN;
    const inUse = await system.isListening(candidate);
    if (!inUse) {
      return candidate;
    }
  }

  return undefined;
}
