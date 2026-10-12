// New workspace content (SPEC-04.1 section 2.4): one Home page, default tokens, standard frames
// and an empty Data Source Catalog. Pure: the workspace service writes the files.
import {
  buildFrames,
  createDefaultTokens,
  type DesignDocument,
  type Frame,
  type Page,
  type ParsedCreateWorkspaceRequest,
  resolvePrimaryFrame,
  SCHEMA_VERSION,
} from '@reactcraft/model';

export {
  buildFrames,
  type CreateWorkspaceRequest,
  CreateWorkspaceRequestSchema,
  FRAME_PRESETS,
} from '@reactcraft/model';

export type NewWorkspaceDeps = {
  /** Random url-safe id of the given length (nanoid). */
  readonly newId: (size: number) => string;
  readonly now: Date;
  /** Interface language, for the default content locale. */
  readonly language?: 'vi' | 'en';
};

function homePage(id: string, rootId: string, primary: Frame): Page {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name: 'Home',
    route: '/',
    root: {
      id: rootId,
      type: 'Stack',
      content: { kind: 'none' },
      style: { direction: 'column', width: 'fill', minHeight: { px: primary.height } },
    },
  };
}

/** The document of a new workspace. The request must be parsed already. */
export function createWorkspaceDocument(
  request: ParsedCreateWorkspaceRequest,
  deps: NewWorkspaceDeps,
): DesignDocument {
  const mode = request.responsiveMode;
  const primary = resolvePrimaryFrame(mode, request.primaryFrame);
  const page = homePage(`p_${deps.newId(10)}`, `n_${deps.newId(10)}`, primary);
  const timestamp = deps.now.toISOString();
  return {
    workspace: {
      schemaVersion: SCHEMA_VERSION,
      id: deps.newId(10),
      name: request.name,
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 0,
      pageOrder: [page.id],
      backends: [],
      responsiveMode: mode,
      frames: buildFrames(mode, primary),
      primaryFrameId: primary.id,
      contentLocale: request.contentLocale ?? (deps.language === 'vi' ? 'vi-VN' : 'en-US'),
      darkMode: request.darkMode,
    },
    tokens: createDefaultTokens(),
    pages: { [page.id]: page },
    components: {},
    dataSources: {
      schemaVersion: SCHEMA_VERSION,
      auth: { kind: 'none' },
      entities: [],
      endpoints: [],
    },
  };
}
