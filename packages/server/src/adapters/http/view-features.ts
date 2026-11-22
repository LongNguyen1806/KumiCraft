// The tools of the open project's view language (docs/architecture/03 section 3.2): a route asks
// for them here and answers "view only" (E023) when the language has none.
import type { AppError } from '@kumicraft/shared';

import type { ViewFeatures } from '../../kernel/features.ts';
import type { ProjectStack } from '../../kernel/stacks.ts';

export const VIEW_ONLY: AppError = { code: 'E023', params: { reason: 'viewOnly' } };

export function viewFeaturesOf(project: { getStack(): ProjectStack }): ViewFeatures | undefined {
  return project.getStack().view.features;
}
