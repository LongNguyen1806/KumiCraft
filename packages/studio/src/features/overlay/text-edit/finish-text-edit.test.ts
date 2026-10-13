import { describe, expect, it } from 'vitest';

import { finishTextEdit } from './finish-text-edit.ts';

describe('finishTextEdit (SPEC-04.1 section 8.4)', () => {
  it('cancels if text is unchanged from original', () => {
    const res = finishTextEdit({
      original: 'Hello world',
      edited: 'Hello world',
      nodeType: 'Text',
    });
    expect(res).toEqual({ kind: 'cancel' });
  });

  it('cancels if text is empty or only whitespace', () => {
    const res = finishTextEdit({
      original: 'Hello world',
      edited: '   \n  \u00A0 ',
      nodeType: 'Text',
    });
    expect(res).toEqual({ kind: 'cancel' });
  });

  it('commits clean single-line text', () => {
    const res = finishTextEdit({
      original: 'Original',
      edited: 'New Text',
      nodeType: 'Button',
    });
    expect(res).toEqual({ kind: 'commit', text: 'New Text' });
  });

  it('strips newlines for single-line node types (Button, Link, Heading)', () => {
    const resButton = finishTextEdit({
      original: 'Old Button',
      edited: 'Line 1\nLine 2',
      nodeType: 'Button',
    });
    expect(resButton).toEqual({ kind: 'commit', text: 'Line 1 Line 2' });

    const resLink = finishTextEdit({
      original: 'Old Link',
      edited: 'Link 1\r\nLink 2',
      nodeType: 'Link',
    });
    expect(resLink).toEqual({ kind: 'commit', text: 'Link 1 Link 2' });

    const resHeading = finishTextEdit({
      original: 'Old Heading',
      edited: 'Heading\nSubtitle',
      nodeType: 'Heading',
    });
    expect(resHeading).toEqual({ kind: 'commit', text: 'Heading Subtitle' });
  });

  it('preserves newlines for Text node type', () => {
    const res = finishTextEdit({
      original: 'First line',
      edited: 'First line\nSecond line\nThird line',
      nodeType: 'Text',
    });
    expect(res).toEqual({ kind: 'commit', text: 'First line\nSecond line\nThird line' });
  });

  it('strips trailing browser nbsp and whitespace', () => {
    const res = finishTextEdit({
      original: 'Old',
      edited: 'Edited content\u00A0  \u00A0',
      nodeType: 'Text',
    });
    expect(res).toEqual({ kind: 'commit', text: 'Edited content' });
  });

  it('removes control characters', () => {
    const res = finishTextEdit({
      original: 'Clean',
      edited: 'Hello\x00\x07\x1BWorld',
      nodeType: 'Text',
    });
    expect(res).toEqual({ kind: 'commit', text: 'HelloWorld' });
  });

  it('handles long text smoothly', () => {
    const longText = 'A'.repeat(5000);
    const res = finishTextEdit({
      original: 'Short',
      edited: longText,
      nodeType: 'Text',
    });
    expect(res).toEqual({ kind: 'commit', text: longText });
  });
});
