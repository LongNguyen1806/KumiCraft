// A stylesheet id or source-map path as a path of the project (SPEC-04 M-ST, R-ST-04).
import { isAbsolute, relative, resolve } from 'node:path';

import { relPathProblem } from '@kumicraft/shared';

/** A Vite module id (`D:/app/src/Card.css?used`) as a path of the project, or undefined outside it. */
export function projectFileOf(root: string, id: string): string | undefined {
  const path = id.split('?')[0] ?? id;
  if (!isAbsolute(path)) return undefined;
  const rel = relative(resolve(root), resolve(path)).replaceAll('\\', '/');
  if (relPathProblem(rel) !== undefined || rel.startsWith('node_modules/')) return undefined;
  return rel;
}
