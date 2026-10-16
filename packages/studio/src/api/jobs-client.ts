// Job endpoints (SPEC-03 section 4.2): status after a lost WebSocket, and cancel.
import { type JobStatus, JobStatusSchema } from '@reactcraft/shared';

import { apiGet, apiPost } from './http.ts';

export async function fetchJob(jobId: string): Promise<JobStatus> {
  return JobStatusSchema.parse(await apiGet(`jobs/${encodeURIComponent(jobId)}`));
}

export async function cancelJob(jobId: string): Promise<void> {
  await apiPost(`jobs/${encodeURIComponent(jobId)}/cancel`);
}
