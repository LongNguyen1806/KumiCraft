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
