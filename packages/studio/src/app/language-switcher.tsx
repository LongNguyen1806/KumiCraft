import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { type Language, LANGUAGES } from '../i18n/i18n.ts';
import { useSettingsStore } from '../store/settings-store.ts';

const isLanguage = (value: string): value is Language =>
  (LANGUAGES as readonly string[]).includes(value);

/** Switches the interface language at once, without reloading the page (ADR-FE-16), and remembers it. */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (isLanguage(value)) void setLanguage(value);
  };

  return (
    <label className="flex h-8 items-center gap-2 rounded-md border border-line whitespace-nowrap bg-card-solid pr-1.5 pl-4 text-ink-soft">
      {t('language.label')}
      <select
        value={i18n.resolvedLanguage}
        onChange={handleChange}
        className="h-8 rounded-md bg-field pr-7 pl-3 text-ink"
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
