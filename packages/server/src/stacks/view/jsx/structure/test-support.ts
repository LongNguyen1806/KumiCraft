// Helpers shared by the structure tests: the repository root and the .tsx files of a folder.
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../../../../../../', import.meta.url));

export async function listTsxFiles(dir: string, relBase = 'src'): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = `${relBase}/${entry.name}`;
    if (entry.isDirectory()) results.push(...(await listTsxFiles(abs, rel)));
    else if (entry.isFile() && entry.name.endsWith('.tsx')) results.push(rel);
  }
  return results.sort((a, b) => a.localeCompare(b));
}
