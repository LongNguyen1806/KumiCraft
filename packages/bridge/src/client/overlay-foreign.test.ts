import { describe, expect, it } from 'vitest';

import { foreignLabel } from './overlay-foreign.ts';

describe('foreignLabel', () => {
  it('[R-CP-11] returns filename without extension when element belongs to foreign file (scenario 15)', () => {
    expect(foreignLabel('src/components/Header.tsx:5:3', 'src/pages/Home.tsx')).toBe('Header');
  });

  it('[R-CP-11] returns undefined when element belongs to same file (scenario 15)', () => {
    expect(foreignLabel('src/pages/Home.tsx:5:3', 'src/pages/Home.tsx')).toBeUndefined();
  });

  it('[R-CP-11] returns undefined when designFile is missing (scenario 15)', () => {
    expect(foreignLabel('src/components/Header.tsx:5:3', undefined)).toBeUndefined();
  });

  it('[R-CP-11] returns undefined when loc is invalid or designFile is empty string', () => {
    expect(foreignLabel('', 'src/pages/Home.tsx')).toBeUndefined();
    expect(foreignLabel('src/components/Header.tsx:5:3', '')).toBeUndefined();
  });
});
