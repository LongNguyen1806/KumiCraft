// Document utilities for chat attachments (WP-3.05a, R-CH-02).
export function isDocFilePath(path: string): boolean {
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const name = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1;
}
