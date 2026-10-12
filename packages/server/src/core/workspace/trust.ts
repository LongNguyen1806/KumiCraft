// Workspace trust (SPEC-05 S-80 to S-84): a trust decision holds for one workspace, in one folder,
// with one set of links. Links that change afterwards, while ReactCraft runs (S-84) or while it is
// closed (a `git pull`, spec-log #92), put the workspace back in restricted mode.
import type { DesignDocument } from '@reactcraft/model';

export type TrustKey = {
  readonly id: string;
  /** Folder of the workspace. */
  readonly path: string;
  /** Fingerprint of the folders the workspace points to: Target Project and backends. */
  readonly links: string;
};

export function trustKeyOf(document: DesignDocument, root: string): TrustKey {
  const { workspace } = document;
  const backends = workspace.backends.map((backend) => backend.path).sort();
  return {
    id: workspace.id,
    path: root,
    links: JSON.stringify([workspace.targetProject?.path ?? '', backends]),
  };
}
