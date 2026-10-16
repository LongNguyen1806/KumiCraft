import { describe, expect, it } from 'vitest';

import { readTags } from './trace-tags.mjs';

describe('trace tags [R-QA-04]', () => {
  it('reads only bracketed code lists as tags [R-QA-04]', () => {
    expect(readTags("it('a [R-SE-05]') it('b [R-TW-01, R-TW-02]')")).toEqual([
      'R-SE-05',
      'R-TW-01',
      'R-TW-02',
    ]);
    expect(readTags("it('[SPEC-04 R-IN-18]') it('R-TX-02: x') it('[R-RN-06, Test 1]')")).toEqual(
      [],
    );
  });
});
