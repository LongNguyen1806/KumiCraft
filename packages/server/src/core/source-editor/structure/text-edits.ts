// Text range replacement without MagicString, tracking new offsets for marks (SPEC-04 section 14).
import { err, ok, type Result } from '@reactcraft/shared';

export type TextEdit = {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly mark?: number | undefined;
};

export type TextEditResult = {
  readonly code: string;
  readonly marks: readonly number[];
};

export function applyTextEdits(code: string, edits: readonly TextEdit[]): Result<TextEditResult> {
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev && curr && prev.end > curr.start) {
      return err({ code: 'E016', params: { reason: 'overlap' } });
    }
  }

  const chunks: string[] = [];
  const marks: number[] = [];
  let cursor = 0;
  let newLen = 0;

  for (const edit of sorted) {
    if (edit.start > cursor) {
      const slice = code.slice(cursor, edit.start);
      chunks.push(slice);
      newLen += slice.length;
    }
    if (edit.mark !== undefined) {
      marks.push(newLen + edit.mark);
    }
    chunks.push(edit.text);
    newLen += edit.text.length;
    cursor = edit.end;
  }

  if (cursor < code.length) {
    chunks.push(code.slice(cursor));
  }

  return ok({ code: chunks.join(''), marks });
}
