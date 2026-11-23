// The style systems of an Express app (03d section 1): the stylesheets it serves from `public/`,
// Tailwind when one of them is a Tailwind entry (`@import "tailwindcss"`) built by the CLI, and
// Bootstrap from its package or `public/`.
import type { StylingReport, StylingSystem } from '@kumicraft/shared';

import type { FileSystemPort } from '../../../ports/file-system-port.ts';

const CSS_DIRS = ['public', 'public/css', 'public/stylesheets', 'src', 'styles'];
const TAILWIND_ENTRY = /@import\s+["']tailwindcss["']|@tailwind\s+base/;

async function cssFiles(fs: FileSystemPort, root: string) {
  const out: { path: string; text: string }[] = [];
  const seen = new Set<string>();
  for (const dir of CSS_DIRS) {
    const entries = await fs.readDir(root, dir);
    if (!entries.ok) continue;
    for (const entry of entries.value) {
      const path = `${dir}/${entry.name}`;
      if (entry.kind !== 'file' || !entry.name.endsWith('.css') || entry.name.endsWith('.min.css'))
        continue;
      if (seen.has(path.toLowerCase())) continue;
      seen.add(path.toLowerCase());
      const read = await fs.readText(root, path, { maxBytes: 2 * 1024 * 1024 });
      if (read.ok) out.push({ path, text: read.value });
    }
  }
  return out;
}

export async function expressStyling(
  fs: FileSystemPort,
  root: string,
  deps: Readonly<Record<string, string>>,
): Promise<{ styling: StylingReport; tailwindCss: string | undefined }> {
  const css = await cssFiles(fs, root);
  const entry = css.find((c) => TAILWIND_ENTRY.test(c.text));
  const tailwind = deps['tailwindcss'];
  const systems: StylingSystem[] = [];
  if (entry !== undefined && tailwind !== undefined) {
    systems.push({ id: 'tailwind', version: tailwind.replace(/^[^\d]*/, '') });
  }
  if (deps['bootstrap'] !== undefined || (await fs.exists(root, 'public/lib/bootstrap'))) {
    systems.push({ id: 'bootstrap' });
  }
  if (css.some((c) => c !== entry)) systems.push({ id: 'css' });
  const primary = systems[0]?.id;
  // The CSS the pages load: Tailwind's built output, not its entry.
  const globalCss = css
    .filter((c) => c !== entry)
    .map((c) => c.path)
    .slice(0, 20);
  return {
    styling: { systems, primary, editable: primary === 'tailwind', globalCss },
    tailwindCss: primary === 'tailwind' ? entry?.path : undefined,
  };
}
