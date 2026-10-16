import type { TFunction } from 'i18next';

import { ApiError } from '../api/http.ts';
import { type ErrorKey, isErrorKey } from '../i18n/error-key.ts';
import enErrors from '../i18n/locales/en/errors.json';

export type ErrorInfo = {
  readonly code: string;
  readonly params?: Readonly<Record<string, unknown>> | undefined;
};

/** Short title of an error code (V-80). */
export function errorTitle(tError: TFunction<'errors'>, code: string): string {
  return isErrorKey(code) ? tError(`${code}.title`) : tError('unknown.title');
}

type ValidReasonPath = {
  [K in ErrorKey]: (typeof enErrors)[K] extends { reasons: Record<string, string> }
    ? `${K}.reasons.${keyof (typeof enErrors)[K]['reasons'] & string}`
    : never;
}[ErrorKey];

const VALID_REASON_PATHS = new Set<string>(
  Object.entries(enErrors).flatMap(([code, entry]) =>
    'reasons' in entry && typeof entry.reasons === 'object'
      ? Object.keys(entry.reasons).map((r) => `${code}.reasons.${r}`)
      : [],
  ),
);

function isReasonPath(path: string): path is ValidReasonPath {
  return VALID_REASON_PATHS.has(path);
}

/** Message, then the sentence of each known reason, then the code: "… … (E023)". */
export function errorText(
  tError: TFunction<'errors'>,
  code: string,
  params?: Readonly<Record<string, unknown>>,
): string {
  if (!isErrorKey(code)) {
    return tError('unknown.message', { code });
  }

  const parts: string[] = [tError(`${code}.message`)];
  const reasons: string[] = [];
  if (typeof params?.['reason'] === 'string') {
    reasons.push(params['reason']);
  } else if (Array.isArray(params?.['reasons'])) {
    for (const item of params['reasons']) {
      if (typeof item === 'string') {
        reasons.push(item);
      }
    }
  }

  for (const reason of reasons) {
    const path = `${code}.reasons.${reason}`;
    if (isReasonPath(path)) {
      parts.push(tError(path));
    }
  }

  return `${parts.join(' ')} (${code})`;
}

/** Reads code and params from what a request threw (ApiError, or anything else → 'network'). */
export function toErrorInfo(error: unknown): ErrorInfo {
  if (error instanceof ApiError) {
    return {
      code: error.code ?? String(error.status),
      params: error.params,
    };
  }
  return { code: 'network' };
}
