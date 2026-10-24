// Detect responsiveMode by scanning source files (SPEC-04 R-PJ-09).
import type { ResponsiveMode } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';

const MAX_FILES_TO_SCAN = 500;
const MAX_REGEX = /\bmax-(sm|md|lg|xl|2xl):/g;
const MIN_REGEX = /(?:^|[\s"'\x60])(sm|md|lg|xl|2xl):/g;

export async function detectResponsiveMode(
  fs: FileSystemPort,
  root: string,
  sourceDir: string = 'src',
): Promise<ResponsiveMode> {
  let maxCount = 0;
  let minCount = 0;

  const queue: string[] = [sourceDir];
  let scannedCount = 0;

  while (queue.length > 0 && scannedCount < MAX_FILES_TO_SCAN) {
    const current = queue.shift();
    if (!current) break;
    const read = await fs.readDir(root, current);
    if (!read.ok) continue;

    for (const entry of read.value) {
      if (scannedCount >= MAX_FILES_TO_SCAN) break;
      const subPath = `${current}/${entry.name}`;
      if (entry.kind === 'directory') {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          queue.push(subPath);
        }
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx')) {
        scannedCount++;
        const content = await fs.readText(root, subPath, { maxBytes: 1024 * 1024 });
        if (content.ok) {
          const maxMatches = content.value.match(MAX_REGEX);
          const minMatches = content.value.match(MIN_REGEX);
          if (maxMatches) maxCount += maxMatches.length;
          if (minMatches) minCount += minMatches.length;
        }
      }
    }
  }

  return minCount > maxCount ? 'mobile-first' : 'desktop-first';
}
