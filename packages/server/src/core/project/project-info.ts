// ProjectInfo of the open project as the API returns it (SPEC-03 section 5.3).
import type { ProjectInfo } from '@reactcraft/shared';

import { getInstallCommand } from './project-install.ts';
import type { OpenWorkspace } from './project-workspace-file.ts';

export function projectInfoOf(state: OpenWorkspace): ProjectInfo {
  return {
    id: state.file.id,
    name: state.file.name,
    root: state.root,
    sourceDir: state.file.sourceDir,
    support: state.support,
    needsInstall: state.needsInstall,
    installCommand: getInstallCommand(state.support.packageManager),
    responsiveMode: state.file.responsiveMode,
    frames: state.file.frames,
    primaryFrameId: state.file.primaryFrameId,
    backends: state.backends,
    trusted: state.trusted,
  };
}
