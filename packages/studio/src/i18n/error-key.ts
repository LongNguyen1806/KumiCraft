// Maps an error reported by the API to a key of the `errors` namespace (ADR-BE-07 rule 5: the
// server sends codes only, the Studio translates).
import enErrors from './locales/en/errors.json';

export type ErrorKey = keyof typeof enErrors;

export const isErrorKey = (code: string): code is ErrorKey => Object.hasOwn(enErrors, code);
