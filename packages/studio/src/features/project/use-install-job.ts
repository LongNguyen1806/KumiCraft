// Runs `install` as a job and follows it over WebSocket (R-PJ-13, R-PJ-22, SPEC-03 section 4.2).
import { MAX_JOB_LINES } from '@kumicraft/shared';
import { useRef, useState } from 'react';

import { cancelJob } from '../../api/jobs-client.ts';
import { installProject } from '../../api/project-client.ts';
import { toErrorInfo } from '../../routes/error-text.ts';
import { failureOf, type JobFailure, useJobFollower } from '../jobs/use-job-follower.ts';

export type InstallPhase = 'idle' | 'starting' | 'running' | 'cancelled';

export type InstallFailure = JobFailure;

export function useInstallJob(
  installCommand: readonly string[],
  onInstalled: () => void,
  startJob: () => Promise<{ readonly jobId: string }> = () => installProject(installCommand),
) {
  const [phase, setPhase] = useState<InstallPhase>('idle');
  const [jobId, setJobId] = useState<string>();
  const [lines, setLines] = useState<readonly string[]>([]);
  const [failure, setFailure] = useState<InstallFailure>();
  const finishedRef = useRef(false);
  const end = (next: InstallPhase, nextFailure?: InstallFailure) => {
    if (finishedRef.current) return false;
    finishedRef.current = true;
    setJobId(undefined);
    setPhase(next);
    if (nextFailure !== undefined) setFailure(nextFailure);
    return true;
  };
  useJobFollower(jobId, {
    onLines: (next) => {
      if (next.length > 0) setLines(next.slice(-MAX_JOB_LINES));
    },
    onCompleted: () => {
      if (end('idle')) onInstalled();
    },
    onFailed: (error) => end('idle', failureOf(error)),
    onCancelled: () => end('cancelled'),
  });
  const start = async () => {
    finishedRef.current = false;
    setPhase('starting');
    setLines([]);
    setFailure(undefined);
    try {
      setJobId((await startJob()).jobId);
      setPhase('running');
    } catch (error) {
      setPhase('idle');
      setFailure({ ...toErrorInfo(error), details: [] });
    }
  };
  const cancel = () => {
    if (jobId !== undefined) void cancelJob(jobId);
  };
  return { phase, lines, failure, start, cancel };
}
