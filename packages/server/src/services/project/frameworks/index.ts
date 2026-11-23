// Picks the stack of a project from the combination table (docs/architecture/03 section 3.4,
// SPEC-04 R-FW-01, R-FW-02). The table itself is given by the composition root (stacks/index.ts),
// so this service knows no runtime or view language.
import type { SupportReport } from '@kumicraft/shared';

import type { DetectInput, ProjectStack, StackTable } from '../../../kernel/stacks.ts';

export type { DetectInput, ProjectStack, StackTable };

type PkgJson = {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
};

export type DetectedStack = { readonly stack: ProjectStack; readonly report: SupportReport };

export async function detectStack(input: DetectInput, stacks: StackTable): Promise<DetectedStack> {
  const reports: DetectedStack[] = [];

  for (const stack of stacks) {
    const report = await stack.runtime.detect(input);
    if (report.supported) return { stack, report };
    reports.push({ stack, report });
  }

  // R-FW-02: none supported. The reason shown is the one of the stack the project points at.
  const pkg = (input.packageJson ?? {}) as PkgJson;
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

  const special = reports.find(({ report }) =>
    report.reasons.some(
      (r) =>
        r === 'craUnsupported' ||
        r === 'nextUnsupported' ||
        r === 'webpackUnsupported' ||
        r === 'noRazorViews',
    ),
  );
  if (special !== undefined) return special;

  const matched = reports.find(({ stack }) => stack.runtime.primaryDependency in deps);
  if (matched !== undefined) return matched;

  const [first] = stacks;
  return reports[0] ?? { stack: first, report: await first.runtime.detect(input) };
}
