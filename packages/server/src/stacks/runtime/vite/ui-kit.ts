// shadcn/ui project detection via root components.json and UI component directory (TK-44).
import * as path from 'node:path';

import { type RelPath, relPathProblem, type UiKitReport } from '@kumicraft/shared';

import type { FileSystemPort } from '../../../ports/file-system-port.ts';

const COMPONENT_FILE_RE = /\.(tsx|jsx|ts|js)$/i;
const IGNORED_STEM_RE = /(?:\.test|\.spec|\.stories|\.d)$/i;
const MAX_COMPONENTS = 100;

/** The plain object `value` is, as a record of its own entries; anything else is undefined. */
function readStringRecord(value: unknown): Record<string, unknown> | undefined {
  if (!(value instanceof Object) || Array.isArray(value)) return undefined;
  const record: Record<string, unknown> = Object.fromEntries(Object.entries(value));
  return record;
}

function candidateUiDirs(importBase: string): RelPath[] {
  const candidates: string[] = [];
  if (importBase.startsWith('@/') || importBase.startsWith('~/')) {
    const stripped = importBase.slice(2).replace(/^\/+/, '').replace(/\/+$/, '');
    if (stripped.length > 0) {
      candidates.push(`src/${stripped}`, stripped);
    }
  } else {
    const cleaned = importBase.replace(/^\.\//, '').replace(/\/+$/, '');
    if (cleaned.length > 0) {
      candidates.push(cleaned);
    }
  }
  if (!candidates.includes('src/components/ui')) {
    candidates.push('src/components/ui');
  }
  return candidates.filter((dir): dir is RelPath => relPathProblem(dir) === undefined);
}

function toComponentStem(fileName: string): string | undefined {
  if (!COMPONENT_FILE_RE.test(fileName)) return undefined;
  const stem = fileName.replace(COMPONENT_FILE_RE, '');
  if (stem.length === 0 || IGNORED_STEM_RE.test(stem)) return undefined;
  return stem;
}

/**
 * Detects shadcn `components.json` at the app root (never `.kumicraft/components.json`)
 * and lists component module stems from the resolved UI directory.
 */
export async function detectUiKit(
  fs: FileSystemPort,
  root: string,
): Promise<UiKitReport | undefined> {
  if (!(await fs.exists(root, 'components.json'))) {
    return undefined;
  }
  const readRes = await fs.readText(root, 'components.json', { maxBytes: 128 * 1024 });
  if (!readRes.ok) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readRes.value);
  } catch {
    return undefined;
  }

  const config = readStringRecord(parsed);
  const aliases = readStringRecord(config?.['aliases']);
  if (aliases === undefined) return undefined;

  const uiAlias = typeof aliases['ui'] === 'string' ? aliases['ui'].trim() : '';
  const componentsAlias =
    typeof aliases['components'] === 'string' ? aliases['components'].trim() : '';
  if (uiAlias.length === 0 && componentsAlias.length === 0) {
    return undefined;
  }

  const importBase =
    uiAlias.length > 0 ? uiAlias.replace(/\/+$/, '') : `${componentsAlias.replace(/\/+$/, '')}/ui`;

  for (const uiDir of candidateUiDirs(importBase)) {
    const entries = await fs.readDir(root, uiDir);
    if (!entries.ok) continue;

    const components = Array.from(
      new Set(
        entries.value
          .filter((entry) => entry.kind === 'file')
          .map((entry) => toComponentStem(entry.name))
          .filter((stem): stem is string => stem !== undefined && stem.length <= 100),
      ),
    )
      .sort()
      .slice(0, MAX_COMPONENTS);

    return {
      kind: 'shadcn',
      uiDir: path.posix.normalize(uiDir),
      importBase,
      components,
    };
  }

  return undefined;
}
