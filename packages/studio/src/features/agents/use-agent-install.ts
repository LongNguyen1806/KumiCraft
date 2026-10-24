// Manages agent install confirmation, job execution, and log follower (R-AG-21).
import { type AgentStatus, MAX_JOB_LINES } from '@kumicraft/shared';
import { useRef, useState } from 'react';

import { installAgent } from '../../api/agent-client.ts';
import { cancelJob } from '../../api/jobs-client.ts';
import { toErrorInfo } from '../../routes/error-text.ts';
import { useAgentsStore } from '../../store/agents-store.ts';
import { failureOf, type JobFailure, useJobFollower } from '../jobs/use-job-follower.ts';

export type AgentInstallPhase = 'idle' | 'confirming' | 'running' | 'failed';

type InstallData = {
  readonly phase: AgentInstallPhase;
  readonly targetAgent?: AgentStatus | undefined;
  readonly jobId?: string | undefined;
  readonly lines: readonly string[];
  readonly failure?: JobFailure | undefined;
};

const INITIAL_DATA: InstallData = { phase: 'idle', lines: [] };

async function executeConfirm(
  agent: AgentStatus,
  setData: (fn: (d: InstallData) => InstallData) => void,
  finishedRef: { current: boolean },
): Promise<void> {
  if (agent.installCommand === undefined) return;
  finishedRef.current = false;
  setData((d) => ({ ...d, phase: 'running', lines: [], failure: undefined }));
  try {
    const started = await installAgent(agent.id, agent.installCommand);
    setData((d) => ({ ...d, jobId: started.jobId }));
  } catch (err) {
    finishedRef.current = true;
    setData((d) => ({ ...d, phase: 'failed', failure: { ...toErrorInfo(err), details: [] } }));
  }
}

export function useAgentInstall() {
  const [data, setData] = useState<InstallData>(INITIAL_DATA);
  const refresh = useAgentsStore((s) => s.refresh);
  const finishedRef = useRef(false);

  useJobFollower(data.jobId, {
    onLines: (next) => {
      if (next.length > 0) setData((d) => ({ ...d, lines: next.slice(-MAX_JOB_LINES) }));
    },
    onCompleted: () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setData(INITIAL_DATA);
      void refresh();
    },
    onFailed: (error) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setData((d) => ({ ...d, phase: 'failed', jobId: undefined, failure: failureOf(error) }));
    },
    onCancelled: () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setData(INITIAL_DATA);
    },
  });

  return {
    phase: data.phase,
    targetAgent: data.targetAgent,
    lines: data.lines,
    failure: data.failure,
    ask: (agent: AgentStatus) => {
      finishedRef.current = false;
      setData({ phase: 'confirming', targetAgent: agent, lines: [] });
    },
    confirm: async () => {
      if (data.targetAgent !== undefined) {
        await executeConfirm(data.targetAgent, setData, finishedRef);
      }
    },
    stop: () => {
      if (data.jobId !== undefined) void cancelJob(data.jobId);
    },
    close: () => {
      if (data.phase !== 'running') setData(INITIAL_DATA);
    },
  };
}
