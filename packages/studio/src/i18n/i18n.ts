// i18n of the Studio (ADR-FE-16): vi and en bundled with the app, en as fallback, language
// switch without reload. Every namespace registers its files here.
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import enErrors from './locales/en/errors.json';
import viCommon from './locales/vi/common.json';
import viErrors from './locales/vi/errors.json';

export const LANGUAGES = ['vi', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const resources = {
  en: { common: enCommon, errors: enErrors },
  vi: { common: viCommon, errors: viErrors },
} as const;

/** First visit: Vietnamese when the browser prefers it, English otherwise. */
export const detectLanguage = (browserLanguage: string): Language =>
  browserLanguage.toLowerCase().startsWith('vi') ? 'vi' : 'en';

export async function initI18n(): Promise<void> {
  i18next.on('languageChanged', (language) => {
    document.documentElement.lang = language;
  });
  await i18next.use(initReactI18next).init({
    resources,
    lng: detectLanguage(navigator.language),
    fallbackLng: 'en',
    supportedLngs: [...LANGUAGES],
    ns: ['common', 'errors'],
    defaultNS: 'common',
    // React escapes every value it renders (SPEC-05 S-14).
    interpolation: { escapeValue: false },
  });
}
