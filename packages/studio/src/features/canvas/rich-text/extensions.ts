// TipTap set-up of the inline text editor (ADR-FE-20): paragraphs, hard breaks and the formats a
// TextRun can hold. Block nodes (headings, lists, quotes…) stay off: the Design Model owns structure.
import Code from '@tiptap/extension-code';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';

/**
 * TipTap's code mark refuses every other format, but a TextRun may be bold code: the mark is
 * widened to match the Design Model (spec-log #89).
 */
const CodeWithFormats = Code.extend({ excludes: '' });

export function richTextExtensions() {
  return [
    StarterKit.configure({
      blockquote: false,
      bulletList: false,
      code: false,
      codeBlock: false,
      dropcursor: false,
      gapcursor: false,
      heading: false,
      horizontalRule: false,
      listItem: false,
      listKeymap: false,
      orderedList: false,
      trailingNode: false,
      // The Studio's own Undo/Redo covers the whole design (SPEC-04.1 section 13).
      undoRedo: false,
      link: {
        openOnClick: false,
        autolink: false,
        // `target` is set only for links that open in a new tab (TextRun.link.newTab).
        HTMLAttributes: { target: '', rel: 'noopener noreferrer nofollow' },
      },
    }),
    CodeWithFormats,
    TextStyle,
    Color,
  ];
}
