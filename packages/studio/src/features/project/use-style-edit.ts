// Hook to determine if visual style editing is available (SPEC-04 Round S1, R-PJ-02).
import type { ProjectInfo } from '@kumicraft/shared';

import { useProjectStore } from './project-store.ts';

export function isStyleEditable(project?: ProjectInfo): boolean {
  if (project === undefined) return true;
  if (project.support.styling !== undefined) {
    return project.support.styling.editable;
  }
  // Older data without `styling`: editable when the project has a Tailwind CSS entry.
  return project.support.tailwindCss !== undefined;
}

export function useStyleEditable(): boolean {
  const project = useProjectStore((s) => s.project);
  return isStyleEditable(project);
}
