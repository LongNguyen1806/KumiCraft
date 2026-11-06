// Framework candidate kind and filter (SPEC-04 K5, WP-4.00, R-FW-03).
import type { AppCandidate } from '@kumicraft/shared';

export type DepMap = Readonly<Record<string, string>>;

export function determineCandidateKind(allDeps: DepMap): AppCandidate['kind'] {
  if ('next' in allDeps) return 'next';
  if ('react-scripts' in allDeps) return 'cra';
  if ('vite' in allDeps && 'react' in allDeps) return 'vite-react';
  if ('express' in allDeps && 'pug' in allDeps) return 'express-pug';
  if ('webpack' in allDeps && 'react' in allDeps && !('vite' in allDeps)) return 'webpack';
  return 'other';
}

export function hasCandidateWebFramework(kind: AppCandidate['kind'], allDeps: DepMap): boolean {
  if (kind !== 'other') return true;
  return 'react' in allDeps || 'vue' in allDeps || 'express' in allDeps;
}
