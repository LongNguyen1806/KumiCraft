import { describe, expect, it } from 'vitest';

import { isErrorKey } from './error-key.ts';
import { detectLanguage } from './i18n.ts';

describe('detectLanguage', () => {
  it('chooses Vietnamese for vi browsers and English otherwise', () => {
    expect(['vi', 'vi-VN', 'VI', 'en-US', 'fr', ''].map(detectLanguage)).toEqual([
      'vi',
      'vi',
      'vi',
      'en',
      'en',
      'en',
    ]);
  });
});

describe('isErrorKey', () => {
  it('recognises every error code and the network key, nothing else', () => {
    expect(isErrorKey('E014')).toBe(true);
    expect(isErrorKey('network')).toBe(true);
    expect(isErrorKey('E999')).toBe(false);
    expect(isErrorKey('toString')).toBe(false);
  });
});
