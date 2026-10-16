import { readFileSync } from 'node:fs';

import { test } from '@playwright/test';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const viUrl = new URL('../../packages/studio/src/i18n/locales/vi/common.json', import.meta.url);
const enUrl = new URL('../../packages/studio/src/i18n/locales/en/common.json', import.meta.url);

const dictionaries: Record<string, unknown> = {
  vi: JSON.parse(readFileSync(viUrl, 'utf8')),
  en: JSON.parse(readFileSync(enUrl, 'utf8')),
};

export function ui(key: string): string {
  const info = test.info();
  const locale = info.project.use.locale;
  const rawLocale = typeof locale === 'string' ? locale : '';
  const lang = rawLocale.startsWith('vi') ? 'vi' : 'en';

  const root = dictionaries[lang];
  if (!isRecord(root)) {
    throw new Error(`Locale dictionary "${lang}" not found`);
  }

  const parts = key.split('.');
  let current: unknown = root;
  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) {
      throw new Error(`Unknown UI key "${key}" at segment "${part}" for locale "${lang}"`);
    }
    current = current[part];
  }

  if (typeof current !== 'string') {
    throw new Error(`UI key "${key}" did not resolve to a string for locale "${lang}"`);
  }

  return current;
}
