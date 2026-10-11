// Mapping between a Design Document and the files of `.reactcraft/` (ADR-BE-11, SPEC-03 section
// 3.1). Pure: the server reads and writes the files.
import type { DesignDocument } from '../schema/document.schema.ts';
import type { WorkspaceFiles } from './migrate.ts';
import { serializeCanonical } from './serialize-canonical.ts';

export const WORKSPACE_DIR = '.reactcraft';

/** ADR-BE-11 rule 2: backups, cache and the session lock never go to Git. */
export const WORKSPACE_GITIGNORE = 'backups/\ncache/\nlock\n';

/** Paths relative to the workspace root, with `/` separators. */
export const workspaceFilePath = {
  workspace: () => `${WORKSPACE_DIR}/workspace.json`,
  tokens: () => `${WORKSPACE_DIR}/tokens.json`,
  dataSources: () => `${WORKSPACE_DIR}/data-sources.json`,
  page: (id: string) => `${WORKSPACE_DIR}/pages/${id}.json`,
  component: (id: string) => `${WORKSPACE_DIR}/components/${id}.json`,
  gitignore: () => `${WORKSPACE_DIR}/.gitignore`,
};

/** Every file of the document in canonical form, keyed by relative path. */
export function documentToFiles(document: DesignDocument): Record<string, string> {
  const files: Record<string, string> = {
    [workspaceFilePath.workspace()]: serializeCanonical('workspace', document.workspace),
    [workspaceFilePath.tokens()]: serializeCanonical('tokens', document.tokens),
    [workspaceFilePath.dataSources()]: serializeCanonical('dataSources', document.dataSources),
    [workspaceFilePath.gitignore()]: WORKSPACE_GITIGNORE,
  };
  for (const page of Object.values(document.pages)) {
    files[workspaceFilePath.page(page.id)] = serializeCanonical('page', page);
  }
  for (const component of Object.values(document.components)) {
    files[workspaceFilePath.component(component.id)] = serializeCanonical('component', component);
  }
  return files;
}

export type AssembledDocument = {
  /** Not validated yet: pass it to checkDocument. */
  readonly document: unknown;
  /** English messages for the log and the Studio, for example orphan pages. */
  readonly warnings: readonly string[];
};

/**
 * Builds the document from migrated files. A page file missing from `pageOrder` is appended to
 * it with a warning (SPEC-04.1 section 2.3 step 5).
 */
export function assembleDocument(files: WorkspaceFiles): AssembledDocument {
  const workspace = (files.workspace instanceof Object ? files.workspace : {}) as {
    pageOrder?: unknown;
  };
  const order = Array.isArray(workspace.pageOrder)
    ? workspace.pageOrder.filter((id): id is string => typeof id === 'string')
    : [];
  const orphans = Object.keys(files.pages)
    .filter((id) => !order.includes(id))
    .sort();
  const warnings = orphans.map((id) => `Page ${id} was not in pageOrder and has been appended`);
  return {
    document: {
      workspace:
        orphans.length === 0
          ? files.workspace
          : { ...workspace, pageOrder: [...order, ...orphans] },
      tokens: files.tokens,
      pages: files.pages,
      components: files.components,
      dataSources: files.dataSources,
    },
    warnings,
  };
}
