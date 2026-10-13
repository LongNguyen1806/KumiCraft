// Pure text edit finalization function (SPEC-04.1 section 8.4).
export type FinishTextEditInput = {
  readonly original: string;
  readonly edited: string;
  readonly nodeType: string;
};

export type FinishTextEditResult =
  { readonly kind: 'commit'; readonly text: string } | { readonly kind: 'cancel' };

/**
 * Normalizes and validates the edited text from contenteditable DOM.
 * Strips formatting, trailing browser nbsp/spaces, handles newlines by node type.
 */
export function finishTextEdit(input: FinishTextEditInput): FinishTextEditResult {
  const { original, nodeType } = input;

  // 1. Normalize line endings (\r\n or \r -> \n)
  let clean = input.edited.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Remove non-printable control characters except \t and \n
  clean = Array.from(clean)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return (code >= 32 && code !== 127) || code === 9 || code === 10;
    })
    .join('');

  // 3. For single-line nodes (Button, Link, Heading): remove all newlines
  if (nodeType === 'Button' || nodeType === 'Link' || nodeType === 'Heading') {
    clean = clean.replace(/\n+/g, ' ');
  }

  // 4. Clean trailing non-breaking spaces and whitespace added by browsers
  clean = clean.replace(/[\u00A0\s]+$/u, '');

  // 5. If empty after trimming or equal to original, cancel
  if (clean.trim().length === 0 || clean === original) {
    return { kind: 'cancel' };
  }

  return { kind: 'commit', text: clean };
}
