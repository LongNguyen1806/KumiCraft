import type { TFunction } from 'i18next';

import { isErrorKey } from '../i18n/error-key.ts';

/** Translated message of an error code, followed by the code for support. */
export function errorText(tError: TFunction<'errors'>, code: string): string {
  return isErrorKey(code) ? `${tError(code)} (${code})` : tError('unknown', { code });
}
