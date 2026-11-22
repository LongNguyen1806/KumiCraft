// Hook reading project edit mode (full vs viewOnly) (SPEC-04 section 1, WP-4.00).
import type { EditMode } from '@kumicraft/shared';

import { useProjectInfo } from '../../core/project-store.ts';

export function useEditMode(): EditMode {
  const project = useProjectInfo();
  return project?.support.editMode ?? 'full';
}
