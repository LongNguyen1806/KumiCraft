import { ERROR_CODES, RUNNER_ERROR_REASONS, UNSUPPORTED_REASONS } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import enErrors from './locales/en/errors.json';
import viErrors from './locales/vi/errors.json';

const MINIMUM_REASONS: Record<string, readonly string[]> = {
  E001: UNSUPPORTED_REASONS,
  E011: ['untrusted'],
  E017: ['moved', 'valueChanged', 'fileChanged'],
  E023: [
    'classExpression',
    'textExpression',
    'textMixed',
    'selfClosing',
    'attrExpression',
    'duplicateAttr',
    'outsideSource',
    'tooLarge',
    'notJsxFile',
  ],
  E025: RUNNER_ERROR_REASONS,
  E026: ['notInstalled', 'notLoggedIn'],
};

describe('errors locale symmetry [V-80]', () => {
  const codes = [...ERROR_CODES, 'network', 'unknown'];

  it.each(codes)('has non-empty title and message for code %s [V-80]', (code) => {
    const en = enErrors[code as keyof typeof enErrors];
    const vi = viErrors[code as keyof typeof viErrors];

    expect(typeof en.title).toBe('string');
    expect(en.title.trim().length).toBeGreaterThan(0);
    expect(typeof en.message).toBe('string');
    expect(en.message.trim().length).toBeGreaterThan(0);

    expect(typeof vi.title).toBe('string');
    expect(vi.title.trim().length).toBeGreaterThan(0);
    expect(typeof vi.message).toBe('string');
    expect(vi.message.trim().length).toBeGreaterThan(0);
  });

  it('has non-empty reasons for all minimum required reasons [V-80]', () => {
    for (const [code, reasons] of Object.entries(MINIMUM_REASONS)) {
      const enEntry = enErrors[code as keyof typeof enErrors] as {
        reasons?: Record<string, string>;
      };
      const viEntry = viErrors[code as keyof typeof viErrors] as {
        reasons?: Record<string, string>;
      };

      expect(enEntry.reasons).toBeDefined();
      expect(viEntry.reasons).toBeDefined();

      for (const reason of reasons) {
        const enReason = enEntry.reasons?.[reason];
        const viReason = viEntry.reasons?.[reason];

        expect(typeof enReason).toBe('string');
        expect(enReason?.trim().length).toBeGreaterThan(0);

        expect(typeof viReason).toBe('string');
        expect(viReason?.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
