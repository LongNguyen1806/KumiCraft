// Canvas class changes sent as intents (03 section 3.3, ADR-A4): the server works out the classes
// from the steps. The Studio works them out too, with the same functions, to stop early when nothing
// changes or a screen cannot be split, and to remember them for turning a frame off (spec-log #126).
import { type ClassStep, err, ok, type Result, type SetClassesEdit } from '@kumicraft/shared';
import { applyClassSteps } from '@kumicraft/style-tailwind';

import { currentClassContext } from '../inspector/screen-scope.ts';

export type PlannedClassEdit = { readonly edit: SetClassesEdit; readonly after: string };

export function planClassEdit(
  target: { readonly loc: string; readonly tag: string },
  before: string,
  steps: readonly ClassStep[],
): Result<PlannedClassEdit> {
  const out = applyClassSteps(before, steps, currentClassContext());
  if (!out.ok) return err({ code: 'E023', params: { reason: out.reason } });
  return ok({
    edit: { kind: 'setClasses', loc: target.loc, tag: target.tag, before, steps: [...steps] },
    after: out.value,
  });
}
