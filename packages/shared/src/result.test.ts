import { describe, expect, it } from 'vitest';

import { ERROR_CODES } from './result.ts';

describe('error codes [V-81]', () => {
  it('never reuses retired error codes [V-81]', () => {
    const retired = ['E004', 'E005', 'E006', 'E007', 'E008', 'E009', 'E010', 'E022'];
    const active = [
      'E001',
      'E002',
      'E003',
      'E011',
      'E012',
      'E013',
      'E014',
      'E015',
      'E016',
      'E017',
      'E018',
      'E019',
      'E020',
      'E021',
      'E023',
      'E024',
      'E025',
      'E026',
      'E027',
      'E028',
    ];

    for (const code of retired) {
      expect((ERROR_CODES as readonly string[]).includes(code)).toBe(false);
    }
    for (const code of active) {
      expect((ERROR_CODES as readonly string[]).includes(code)).toBe(true);
    }
  });
});
