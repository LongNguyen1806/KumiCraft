// Runner REST client (SPEC-03 section 5.4, R-RN-01..09).
import type { RunnerStatus } from '@reactcraft/shared';

import { apiGet, apiPost } from './http.ts';

export async function fetchRunnerStatus(): Promise<RunnerStatus> {
  const result = await apiGet('runner');
  return result as RunnerStatus;
}

export async function startRunner(): Promise<RunnerStatus> {
  const result = await apiPost('runner/start');
  return result as RunnerStatus;
}

export async function restartRunner(): Promise<RunnerStatus> {
  const result = await apiPost('runner/restart');
  return result as RunnerStatus;
}

export async function stopRunner(): Promise<RunnerStatus> {
  const result = await apiPost('runner/stop');
  return result as RunnerStatus;
}
