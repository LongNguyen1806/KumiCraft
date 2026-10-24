// Runner REST client (SPEC-03 section 5.4, R-RN-01..09).
import { type RunnerStatus, RunnerStatusSchema } from '@kumicraft/shared';

import { apiGet, apiPost, parseResponse } from './http.ts';

export async function fetchRunnerStatus(): Promise<RunnerStatus> {
  return parseResponse(RunnerStatusSchema, await apiGet('runner'));
}

export async function startRunner(): Promise<RunnerStatus> {
  return parseResponse(RunnerStatusSchema, await apiPost('runner/start'));
}

export async function restartRunner(): Promise<RunnerStatus> {
  return parseResponse(RunnerStatusSchema, await apiPost('runner/restart'));
}

export async function stopRunner(): Promise<RunnerStatus> {
  return parseResponse(RunnerStatusSchema, await apiPost('runner/stop'));
}
