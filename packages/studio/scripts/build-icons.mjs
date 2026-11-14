// Builds compact offline Lucide icon JSON from lucide-react ESM icon modules (K9.7-2 TK-6).
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ALLOWED_TAGS = new Set([
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'ellipse',
  'g',
]);

function resolveIconsDir() {
  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve('lucide-react/package.json');
  return path.join(path.dirname(pkgJsonPath), 'dist', 'esm', 'icons');
}

function cleanIconNode(rawNode) {
  if (!Array.isArray(rawNode) || rawNode.length === 0) return undefined;
  const out = [];
  for (const item of rawNode) {
    if (!Array.isArray(item) || item.length < 2) return undefined;
    const [tag, rawAttrs] = item;
    if (typeof tag !== 'string' || !ALLOWED_TAGS.has(tag)) return undefined;
    if (typeof rawAttrs !== 'object' || rawAttrs === undefined) return undefined;
    const attrs = {};
    for (const [k, v] of Object.entries(rawAttrs)) {
      if (k === 'key') continue;
      if (typeof v === 'string' || typeof v === 'number') {
        attrs[k] = v;
      }
    }
    out.push([tag, attrs]);
  }
  return out.length > 0 ? out : undefined;
}

async function readAllIcons(iconsDir) {
  const entries = await fs.readdir(iconsDir);
  const mjsFiles = entries.filter((f) => f.endsWith('.mjs') && !f.endsWith('.d.mts')).sort();
  const icons = [];
  for (const file of mjsFiles) {
    const mod = await import(pathToFileURL(path.join(iconsDir, file)).href);
    const data = mod.__iconData;
    if (typeof data !== 'object' || data === undefined) continue;
    const name = typeof data.name === 'string' ? data.name : file.replace(/\.mjs$/, '');
    if (!/^[a-z0-9-]+$/.test(name)) continue;
    const node = cleanIconNode(data.node);
    if (node === undefined) continue;
    icons.push([name, node]);
  }
  return icons;
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.resolve(here, '..', 'src', 'features', 'icons', 'icons.generated.json');
  const iconsDir = resolveIconsDir();
  const icons = await readAllIcons(iconsDir);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify({ icons }), 'utf8');
  process.stdout.write(`Generated ${String(icons.length)} icons -> ${outPath}\n`);
}

await main();
