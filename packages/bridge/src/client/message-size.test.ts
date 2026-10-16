// The size limit of one Bridge message (V-112).
import { describe, expect, it } from 'vitest';

import { fitsMessageLimit, MAX_MESSAGE_BYTES } from './message-size.ts';

const envelope = (text: string) => ({ rc: 1, nonce: 'n'.repeat(22), type: 'x', payload: { text } });

describe('Bridge message size [V-112]', () => {
  it('accepts a message up to 1 MB of JSON and refuses a larger one', () => {
    const overhead = JSON.stringify(envelope('')).length;

    expect(fitsMessageLimit(envelope('a'.repeat(MAX_MESSAGE_BYTES - overhead)))).toBe(true);
    expect(fitsMessageLimit(envelope('a'.repeat(MAX_MESSAGE_BYTES - overhead + 1)))).toBe(false);
  });

  it('counts bytes, not characters, so Vietnamese text cannot slip over the limit', () => {
    const overhead = JSON.stringify(envelope('')).length;
    // "ữ" is one character but three bytes in UTF-8.
    const chars = Math.ceil((MAX_MESSAGE_BYTES - overhead) / 3) + 1;

    expect(fitsMessageLimit(envelope('ữ'.repeat(chars)))).toBe(false);
  });
});
