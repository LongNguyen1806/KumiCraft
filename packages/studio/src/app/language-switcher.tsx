import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { type Language, LANGUAGES } from '../i18n/i18n.ts';

const isLanguage = (value: string): value is Language =>
  (LANGUAGES as readonly string[]).includes(value);

/** Switches the interface language at once, without reloading the page (ADR-FE-16). */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (isLanguage(value)) void i18n.changeLanguage(value);
  };

  return (
    <label className="flex items-center gap-2 text-sm text-neutral-600">
      {t('language.label')}
      <select
        value={i18n.resolvedLanguage}
        onChange={handleChange}
        className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-neutral-900"
        data-testid="language-select"
      >
        {LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {t(`language.${language}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
