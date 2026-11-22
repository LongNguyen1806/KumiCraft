import i18next from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import { ApiError } from '../api/http.ts';
import { initI18n } from '../i18n/i18n.ts';
import { errorText, errorTitle, toErrorInfo } from './error-text.ts';

describe('error-text [V-80]', () => {
  beforeAll(async () => {
    await initI18n();
    await i18next.changeLanguage('en');
  });

  const getT = () => i18next.getFixedT('en', 'errors');

  it('translates unknown code with code placeholder [V-80]', () => {
    const tError = getT();
    const result = errorText(tError, 'E999');
    expect(result).toContain('E999');
    expect(result).toBe('Unexpected error (E999).');
  });

  it('includes message and reason sentence, ending with code for single reason [V-80]', () => {
    const tError = getT();
    const result = errorText(tError, 'E017', { reason: 'fileChanged' });
    expect(result).toContain(
      'The source code changed elsewhere since it was read. It was reloaded.',
    );
    expect(result).toContain('File was modified externally.');
    expect(result.endsWith('(E017)')).toBe(true);
  });

  it('includes both reason sentences for multiple reasons array [V-80]', () => {
    const tError = getT();
    const result = errorText(tError, 'E001', { reasons: ['noVite', 'noTailwind'] });
    expect(result).toContain('KumiCraft cannot open this project yet.');
    expect(result).toContain('Vite is not installed.');
    expect(result).toContain('Tailwind CSS is not installed.');
    expect(result.endsWith('(E001)')).toBe(true);
  });

  it('explains what E021 says is missing, and stays generic for an unlisted item [V-80, R-AG-21]', () => {
    const tError = getT();
    const terminal = errorText(tError, 'E021', { missing: 'terminal' });
    expect(terminal).toContain(
      'Could not open a terminal window. Please open a terminal and run the agy command manually.',
    );
    expect(terminal.endsWith('(E021)')).toBe(true);

    const editor = errorText(tError, 'E021', { missing: 'editor' });
    expect(editor).toBe(`${tError('E021.message')} (E021)`);
  });

  it('ignores unknown reason without leaking technical names [V-80]', () => {
    const tError = getT();
    const result = errorText(tError, 'E017', { reason: 'zzz' });
    expect(result).not.toContain('zzz');
    expect(result).toBe(
      'The source code changed elsewhere since it was read. It was reloaded. (E017)',
    );
  });

  it('provides short title for known code and unknown [V-80]', () => {
    const tError = getT();
    expect(errorTitle(tError, 'E017')).toBe('Source Changed');
    expect(errorTitle(tError, 'unknown')).toBe('Unknown Error');
    expect(errorTitle(tError, 'invalidCode')).toBe('Unknown Error');
  });

  describe('toErrorInfo [V-80]', () => {
    it('extracts code and params from ApiError [V-80]', () => {
      const error = new ApiError(409, 'E017', { reason: 'moved' });
      expect(toErrorInfo(error)).toEqual({
        code: 'E017',
        params: { reason: 'moved' },
      });
    });

    it('falls back to network for other errors [V-80]', () => {
      expect(toErrorInfo(new TypeError('network failed'))).toEqual({
        code: 'network',
      });
    });
  });
});
