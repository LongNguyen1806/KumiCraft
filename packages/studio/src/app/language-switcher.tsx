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
    <label className="flex h-10 items-center gap-2 rounded-full bg-card pr-1.5 pl-4 text-ink-soft shadow-soft">
      {t('language.label')}
      <select
        value={i18n.resolvedLanguage}
        onChange={handleChange}
        className="h-8 rounded-full bg-field pr-7 pl-3 text-ink"
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
