// Framework adapters registry and detection orchestrator (SPEC-04 R-FW-01, R-FW-02).
import type { SupportReport } from '@reactcraft/shared';

import type { DetectInput, FrameworkAdapter } from './types.ts';
import { viteReactAdapter } from './vite-react/index.ts';

export * from './types.ts';
export { viteReactAdapter } from './vite-react/index.ts';

export const FRAMEWORK_ADAPTERS: readonly FrameworkAdapter[] = [viteReactAdapter];

type PkgJson = {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
};

export async function detectFramework(
  input: DetectInput,
  adapters: readonly FrameworkAdapter[] = FRAMEWORK_ADAPTERS,
): Promise<{ readonly adapter: FrameworkAdapter; readonly report: SupportReport }> {
  const reports: { adapter: FrameworkAdapter; report: SupportReport }[] = [];

  for (const adapter of adapters) {
    const report = await adapter.detect(input);
    if (report.supported) {
      return { adapter, report };
    }
    reports.push({ adapter, report });
  }

  // R-FW-02: None supported. Pick adapter whose primaryDependency is in project dependencies.
  const pkg = (input.packageJson ?? {}) as PkgJson;
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

  const matched = reports.find(({ adapter }) => adapter.primaryDependency in deps);
  if (matched !== undefined) {
    return matched;
  }

  // Default to first adapter
  return reports[0] ?? { adapter: viteReactAdapter, report: await viteReactAdapter.detect(input) };
}
