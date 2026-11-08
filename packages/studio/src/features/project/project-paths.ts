// Folder paths as the project dialogs show them (Windows `\` or `/`, macOS and Linux `/`).

/** Characters no folder name may hold on Windows, macOS or Linux, plus `.`/`..` and a trailing dot. */
const BAD_FOLDER_NAME = /[\\/:*?"<>|]|^\.{1,2}$|[. ]$/;

export function isValidFolderName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed !== '' && !BAD_FOLDER_NAME.test(trimmed);
}

function separatorOf(path: string): string {
  return path.includes('\\') && !path.includes('/') ? '\\' : '/';
}

/** `location/name` with the separator `location` already uses. */
export function childPath(location: string, name: string): string {
  return `${location.replace(/[\\/]+$/, '')}${separatorOf(location)}${name.trim()}`;
}

/** The folder that holds `path`; undefined for a drive or `/`. */
export function parentDir(path: string): string | undefined {
  const trimmed = path.replace(/[\\/]+$/, '');
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  if (cut < 0) return undefined;
  const parent = trimmed.slice(0, cut);
  if (parent === '') return '/';
  return /^[A-Za-z]:$/.test(parent) ? `${parent}${separatorOf(path)}` : parent;
}

/** The last segment of `path`. */
export function baseName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  return trimmed.slice(Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\')) + 1);
}
