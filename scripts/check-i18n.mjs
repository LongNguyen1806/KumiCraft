// `pnpm check:i18n` (VG-12): every key exists in both vi and en, no extra keys, and each
// translation uses the same {{placeholders}} in both languages.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = 'packages/studio/src/i18n/locales';
const LANGUAGES = ['en', 'vi'];

const flatten = (value, prefix = '') =>
  Object.entries(value).flatMap(([key, child]) =>
    child instanceof Object
      ? flatten(child, `${prefix}${key}.`)
      : [[`${prefix}${key}`, String(child)]],
  );

const placeholders = (text) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

const namespaces = new Set(
  LANGUAGES.flatMap((language) => readdirSync(join(LOCALES_DIR, language))),
);
const problems = [];

for (const file of [...namespaces].sort()) {
  const tables = {};
  for (const language of LANGUAGES) {
    try {
      tables[language] = new Map(
        flatten(JSON.parse(readFileSync(join(LOCALES_DIR, language, file), 'utf8'))),
      );
    } catch (error) {
      problems.push(
        `${language}/${file}: ${error.code === 'ENOENT' ? 'missing file' : error.message}`,
      );
    }
  }
  if (Object.keys(tables).length !== LANGUAGES.length) continue;

  const [base, other] = LANGUAGES;
  for (const [a, b] of [
    [base, other],
    [other, base],
  ]) {
    for (const key of tables[a].keys()) {
      if (!tables[b].has(key))
        problems.push(`${b}/${file}: missing key "${key}" (present in ${a})`);
    }
  }
  for (const [key, text] of tables[base]) {
    const otherText = tables[other].get(key);
    if (otherText === undefined) continue;
    if (placeholders(text).join() !== placeholders(otherText).join()) {
      problems.push(`${file} "${key}": placeholders differ between ${base} and ${other}`);
    }
    if (otherText.trim() === '') problems.push(`${other}/${file} "${key}": empty translation`);
  }
}

if (problems.length > 0) {
  console.error(`check:i18n found ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log(`check:i18n: ${namespaces.size} namespace(s), vi and en match.`);
}
