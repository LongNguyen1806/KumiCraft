// Hook to determine if visual style editing is available (SPEC-04 Round S1, R-PJ-02).
import { primarySystem, type ProjectInfo } from '@kumicraft/shared';

import { useProjectStore } from '../../core/project-store.ts';

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

/**
 * Whether the style layer works for the project (Brand, Library, style Inspector): any styling
 * system with an adapter (R-ST-02), not only the Tailwind editor of `isStyleEditable`.
 */
export function isStyleLayerSupported(project?: ProjectInfo): boolean {
  const styling = project?.support.styling;
  return styling === undefined || primarySystem(styling) !== undefined;
}

export function useStyleLayerSupported(): boolean {
  const project = useProjectStore((s) => s.project);
  return isStyleLayerSupported(project);
}
