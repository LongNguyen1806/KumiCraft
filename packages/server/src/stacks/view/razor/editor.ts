// The Razor editor (docs/architecture/03c section 3): .cshtml as a text view language. Razor finds
// its elements (with the C# ranges of the Razor helper) and plans text changes on their HTML; the
// kernel's text view editor locates, writes, records Undo, and saves images and block CSS.
import type { StylingReport } from '@kumicraft/shared';

import type { SourceEditorService } from '../../../kernel/editing.ts';
import { createTextViewEditor, type TextViewLanguage } from '../../../kernel/text-view-editor.ts';
import type { RazorElement } from '../../../lib/razor/markup.ts';
import { razorElementEdit } from './element-edits.ts';
import { razorElementSource } from './element-source.ts';
import { razorPageTree, razorSourceFiles } from './page-tree.ts';
import { elementAt, loadRazorFile, type RazorFile, type RazorIo } from './razor-file.ts';
import { planRazorStructure } from './structure-ops.ts';

export type RazorEditorDeps = RazorIo & {
  readonly styling: () => StylingReport | undefined;
};

export function razorLanguage(io: RazorIo): TextViewLanguage<RazorFile, RazorElement> {
  return {
    extension: '.cshtml',
    notFileReason: 'notRazorFile',
    imagesDir: 'wwwroot/images',
    imagesUrl: '/images',
    defaultCss: 'wwwroot/css/site.css',
    load: (root, rel) => loadRazorFile(io, root, rel),
    elementAt,
    tagOf: (element) => element.tag,
    source: (file, element, loc) => razorElementSource(file.doc, element, loc, file.hash),
    outerText: (file, element) =>
      file.text.slice(element.start, element.close?.end ?? element.openEnd),
    edit: (file, element, edit) => razorElementEdit(file.doc, element, edit),
    structure: (input, edit) =>
      planRazorStructure(
        {
          doc: input.file.doc,
          newline: input.file.newline,
          styling: input.styling,
          elements: input.elements,
          ref: input.ref,
          imageSrc: input.imageSrc,
        },
        edit,
      ),
    pageTree: razorPageTree,
    sourceFiles: (root) => razorSourceFiles(io.fs, root),
  };
}

/** The Razor views' SourceEditorService. */
export function createRazorEditor(deps: RazorEditorDeps): SourceEditorService {
  return createTextViewEditor(razorLanguage(deps), deps);
}
