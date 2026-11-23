// What the rest of KumiCraft may ask of a view language's editor (docs/architecture/03 section
// 3.2). The HTTP routes, the services and the style stack depend on this interface, never on one
// editor; the JSX editor in `stacks/view/jsx` implements it.
import type {
  AttributeLevelEdit,
  BatchEditResult,
  EditResult,
  ElementSource,
  ElementText,
  PageTree,
  Result,
  SetClassesEdit,
  SetClassNameEdit,
  SourceEdit,
  StructureEdit,
  StructureResult,
} from '@kumicraft/shared';

/** The file around one write, exactly as it was and is on disk (BOM included), for the history. */
export type WrittenFile = {
  readonly path: string;
  readonly before?: string | undefined;
  readonly after: string;
  readonly beforeHash?: string | undefined;
  readonly afterHash: string;
  readonly encoding?: 'base64' | undefined;
};

/** Code and style files of the source folder. */
export type SourceFiles = { readonly files: readonly string[]; readonly truncated: boolean };

export interface SourceEditorService {
  getElement(projectRoot: string, loc: string): Promise<Result<ElementSource>>;
  getElementText(projectRoot: string, loc: string): Promise<Result<ElementText>>;
  /** Element tree of one view file for external AI agents (R-AG-19). */
  getPageTree(projectRoot: string, file: string, maxDepth?: number): Promise<Result<PageTree>>;
  /** Code and style files of the source folder for external AI agents (R-AG-19). */
  listFiles(projectRoot: string): Promise<Result<SourceFiles>>;
  /**
   * Applies one edit. `onWritten` runs inside the queue of the file, right after the write, so the
   * history records exactly the bytes this edit replaced, even when edits of the file overlap.
   */
  applyEdit(
    projectRoot: string,
    edit: SourceEdit,
    onWritten?: (file: WrittenFile) => void,
  ): Promise<Result<EditResult>>;
  applyStructureEdit(
    projectRoot: string,
    edit: StructureEdit,
    onWritten?: (files: readonly WrittenFile[]) => void,
  ): Promise<Result<StructureResult>>;
  applyEditBatch(
    projectRoot: string,
    edits: readonly AttributeLevelEdit[],
    onWritten?: (files: readonly WrittenFile[]) => void,
  ): Promise<Result<BatchEditResult>>;
}

/**
 * Turns a class edit sent as intents into the classes it writes (03 section 4, ADR-A4). The routes
 * resolve it before the view editor runs, so no editor has to know about intents.
 */
export interface ClassEditResolver {
  resolve(edits: readonly SetClassesEdit[]): Promise<Result<SetClassNameEdit[]>>;
}

/**
 * The editor of the open project's view language (03c section 2.1): one SourceEditorService the
 * routes use, handing each call to the editor of the language the project is written in.
 */
export function editorByView(
  viewId: () => string,
  editors: { readonly default: SourceEditorService } & Readonly<
    Record<string, SourceEditorService>
  >,
): SourceEditorService {
  const pick = (): SourceEditorService => editors[viewId()] ?? editors.default;
  return {
    getElement: (root, loc) => pick().getElement(root, loc),
    getElementText: (root, loc) => pick().getElementText(root, loc),
    getPageTree: (root, file, maxDepth) => pick().getPageTree(root, file, maxDepth),
    listFiles: (root) => pick().listFiles(root),
    applyEdit: (root, edit, onWritten) => pick().applyEdit(root, edit, onWritten),
    applyStructureEdit: (root, edit, onWritten) => pick().applyStructureEdit(root, edit, onWritten),
    applyEditBatch: (root, edits, onWritten) => pick().applyEditBatch(root, edits, onWritten),
  };
}
