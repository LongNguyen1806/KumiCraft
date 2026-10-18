// Helper for component naming, route paths and filenames (R-PG-11, R-PJ-11).

function stripDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('đ', 'd')
    .replaceAll('Đ', 'D');
}

/** Converts user-provided page name to a PascalCase component identifier. */
export function toComponentName(name: string): string {
  const clean = stripDiacritics(name);
  const parts = clean.split(/[^A-Za-z0-9]+/).filter((p) => p.length > 0);
  const capitalized = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  if (capitalized.length === 0) return 'Page';
  if (/^[0-9]/.test(capitalized)) return `Page${capitalized}`;
  return capitalized;
}

/** Converts user-provided page name to a kebab-case URL route path starting with '/'. */
export function toRoutePath(name: string): string {
  const clean = stripDiacritics(name).toLowerCase();
  const slug = clean
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const pathPart = slug.length > 0 ? slug : 'page';
  return `/${pathPart}`;
}

export type PageNamesResult = {
  readonly component: string;
  readonly path: string;
  readonly fileName: string;
};

/**
 * Computes component name, URL path and file name for a page (R-PG-11, R-PJ-11).
 */
export function pageNames(name: string, language: 'ts' | 'js'): PageNamesResult {
  const component = toComponentName(name);
  const path = toRoutePath(name);
  const ext = language === 'js' ? 'jsx' : 'tsx';
  return {
    component,
    path,
    fileName: `${component}.${ext}`,
  };
}
