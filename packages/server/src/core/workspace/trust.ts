// Project trust (SPEC-05 S-80 to S-84, R-PJ-15): a trust decision holds for one project, in one
// folder, with one set of backend links. Links that change afterwards, while ReactCraft runs or
// while it is closed (a `git pull`), put the project back in restricted mode.
import type { WorkspaceFile } from '@reactcraft/shared';

export type TrustKey = {
  readonly id: string;
  /** Root folder of the project. */
  readonly path: string;
  /** Fingerprint of the backend folders the project links to. */
  readonly links: string;
};

export function trustKeyOf(file: WorkspaceFile, root: string): TrustKey {
  const backends = file.backends.map((backend) => backend.path).sort();
  return { id: file.id, path: root, links: JSON.stringify(backends) };
}
