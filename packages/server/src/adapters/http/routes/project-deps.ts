// What the project routes need from the server (SPEC-03 section 5.3).
import type { UsageCounter } from '../../../kernel/features.ts';
import type { HistoryService } from '../../../kernel/history/history-service.ts';
import type { SessionInfo } from '../../../kernel/session.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';
import type { ProcessPort } from '../../../ports/process-port.ts';
import type { ConfigStore } from '../../../services/config/user-config.ts';
import type { ProjectService } from '../../../services/project/project-service.ts';

export type ProjectRoutesDeps = {
  readonly projectService: ProjectService;
  readonly getSessionInfo: () => SessionInfo;
  readonly fs?: FileSystemPort | undefined;
  readonly process?: ProcessPort | undefined;
  readonly tsInspectScript?: string | undefined;
  readonly usageCounter?: UsageCounter | undefined;
  readonly recents?: Pick<ConfigStore, 'recentProjects' | 'forgetProject'> | undefined;
  readonly historyService?: HistoryService | undefined;
};
