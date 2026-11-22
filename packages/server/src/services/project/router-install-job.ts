// "Add a router" (R-RT-04): the view language writes the router files, then the project's package
// manager installs the router package as a job.
import { err, type Result } from '@kumicraft/shared';

import type { ProjectFeatures } from '../../kernel/features.ts';
import type { HistoryService } from '../../kernel/history/history-service.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import type { ProcessPort } from '../../ports/process-port.ts';
import type { JobService } from '../jobs/job-service.ts';
import { getInstallCommand, startInstallJob } from './project-install.ts';
import type { WorkspaceState } from './project-types.ts';

function isHistoryService(h: unknown): h is HistoryService {
  return !!h && typeof h === 'object' && 'push' in h;
}

export async function installProjectRouter(
  state: WorkspaceState,
  deps: {
    readonly fs: FileSystemPort;
    readonly history?: HistoryService | Pick<HistoryService, 'clear'> | undefined;
    readonly jobs: JobService;
    readonly process: ProcessPort;
    readonly features: ProjectFeatures | undefined;
  },
  onCompleted: (root: string) => Promise<void>,
): Promise<Result<{ readonly jobId: string }>> {
  if (state.status !== 'open') return err({ code: 'E021', params: { missing: 'project' } });
  if (!state.trusted)
    return err({ code: 'E011', params: { path: state.root, reason: 'untrusted' } });
  const expectedCommand = getInstallCommand(state.support.packageManager);
  if (!expectedCommand) return err({ code: 'E021', params: { missing: 'packageManager' } });
  if (!isHistoryService(deps.history)) return err({ code: 'E021', params: { missing: 'history' } });
  if (deps.features === undefined) return err({ code: 'E023', params: { reason: 'viewOnly' } });

  const { root, file } = state;
  const written = await deps.features.writeRouterFiles(
    { fs: deps.fs, history: deps.history },
    {
      root,
      sourceDir: file.sourceDir,
      routingFile: file.routing?.file,
      language: state.support.language,
    },
  );
  if (!written.ok) return written;

  return startInstallJob(
    { jobs: deps.jobs, process: deps.process },
    root,
    expectedCommand,
    expectedCommand,
    () => onCompleted(root),
  );
}
