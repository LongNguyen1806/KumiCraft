// Framework adapters registry and detection orchestrator (SPEC-04 R-FW-01, R-FW-02).
import type { SupportReport } from '@kumicraft/shared';

import { expressPugAdapter } from './express-pug/index.ts';
import type { DetectInput, FrameworkAdapter } from './types.ts';
import { viteReactAdapter } from './vite-react/index.ts';

export { expressPugAdapter } from './express-pug/index.ts';
export * from './types.ts';
export { viteReactAdapter } from './vite-react/index.ts';

export const defaultAdapter: FrameworkAdapter = viteReactAdapter;

export const FRAMEWORK_ADAPTERS: readonly FrameworkAdapter[] = [
  viteReactAdapter,
  expressPugAdapter,
];

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

  const specialReport = reports.find(({ report }) =>
    report.reasons.some(
      (r) => r === 'craUnsupported' || r === 'nextUnsupported' || r === 'webpackUnsupported',
    ),
  );
  if (specialReport !== undefined) {
    return specialReport;
  }

  const matched = reports.find(({ adapter }) => adapter.primaryDependency in deps);
  if (matched !== undefined) {
    return matched;
  }

  // Default to first adapter
  return reports[0] ?? { adapter: viteReactAdapter, report: await viteReactAdapter.detect(input) };
}
