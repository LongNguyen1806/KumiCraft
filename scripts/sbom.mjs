// S-95: SBOM (CycloneDX 1.5 JSON) and third-party license report of the published `kumicraft`
// package: every package `npm install kumicraft` brings in (the runtime `dependencies` of
// packages/cli and theirs). Writes artifacts/kumicraft-<version>.cdx.json and
// artifacts/THIRD_PARTY_LICENSES.md; exits 1 when a license is missing or not on the allow list.
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'packages', 'cli');
const OUT = join(ROOT, 'artifacts');

/** Licenses that allow use and redistribution in an MIT tool without extra duties. */
const ALLOWED = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  '0BSD',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'CC-BY-4.0',
  'Python-2.0',
  'Unlicense',
  'MIT-0',
]);

function licenseOf(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && typeof pkg.license.type === 'string') return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type ?? l).join(' OR ');
  return '';
}

/** `(MIT OR Apache-2.0)` is fine when one choice is allowed; `AND` needs all of them. */
function allowed(expr) {
  const text = expr.replace(/[()]/g, ' ').trim();
  if (text === '') return false;
  if (/ OR /.test(text)) return text.split(/ OR /).some((p) => allowed(p));
  return text.split(/ AND /).every((p) => ALLOWED.has(p.trim()));
}

function readPackage(dir) {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
}

/** The folder of `name` as Node resolves it from `fromDir` (pnpm layout included). */
function resolveDir(name, fromDir) {
  // `resolve.paths` gives null for names of Node built-ins (`string_decoder`): walk up by hand.
  const paths = [];
  for (let dir = fromDir; ; dir = dirname(dir)) {
    paths.push(join(dir, 'node_modules'));
    if (dirname(dir) === dir) break;
  }
  for (const base of paths) {
    const dir = join(base, name);
    if (existsSync(join(dir, 'package.json'))) return realpathSync(dir);
  }
  return undefined;
}

const cli = readPackage(CLI);
const found = new Map();
const missing = [];
const queue = Object.keys(cli.dependencies ?? {}).map((name) => ({ name, from: CLI }));
while (queue.length > 0) {
  const { name, from } = queue.shift();
  const dir = resolveDir(name, from);
  if (dir === undefined) {
    missing.push(name);
    continue;
  }
  const pkg = readPackage(dir);
  const key = `${pkg.name}@${pkg.version}`;
  if (found.has(key)) continue;
  found.set(key, { name: pkg.name, version: pkg.version, license: licenseOf(pkg), dir });
  for (const dep of Object.keys(pkg.dependencies ?? {})) queue.push({ name: dep, from: dir });
  // Optional dependencies are installed when the platform has them; list those present.
  for (const dep of Object.keys(pkg.optionalDependencies ?? {})) {
    if (resolveDir(dep, dir) !== undefined) queue.push({ name: dep, from: dir });
  }
}

const components = [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
const bad = components.filter((c) => !allowed(c.license));
const purl = (c) =>
  `pkg:npm/${c.name.startsWith('@') ? `%40${c.name.slice(1)}` : c.name}@${c.version}`;

const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: {
    component: {
      type: 'application',
      name: cli.name,
      version: cli.version,
      purl: purl(cli),
      licenses: [{ license: { id: cli.license } }],
    },
  },
  components: components.map((c) => ({
    type: 'library',
    name: c.name,
    version: c.version,
    purl: purl(c),
    licenses: c.license === '' ? [] : [{ expression: c.license }],
  })),
};

const licenseText = (c) => {
  for (const f of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'LICENCE', 'license.md']) {
    const p = join(c.dir, f);
    if (existsSync(p)) return readFileSync(p, 'utf8').trim();
  }
  return '(no license file in the package; license field: ' + (c.license || 'none') + ')';
};
const report = [
  `# Third-party licenses of kumicraft ${cli.version}`,
  '',
  `${String(components.length)} packages installed with \`npm install kumicraft\`.`,
  '',
  '| Package | Version | License |',
  '| ------- | ------- | ------- |',
  ...components.map((c) => `| ${c.name} | ${c.version} | ${c.license || '—'} |`),
  '',
  ...components.flatMap((c) => [`## ${c.name} ${c.version}`, '', '```', licenseText(c), '```', '']),
].join('\n');

mkdirSync(OUT, { recursive: true });
writeFileSync(
  join(OUT, `kumicraft-${cli.version}.cdx.json`),
  JSON.stringify(bom, undefined, 2) + '\n',
);
writeFileSync(join(OUT, 'THIRD_PARTY_LICENSES.md'), report);
console.log(
  `SBOM: ${String(components.length)} packages -> artifacts/kumicraft-${cli.version}.cdx.json`,
);
if (missing.length > 0) console.log(`Not installed (skipped): ${[...new Set(missing)].join(', ')}`);
if (bad.length > 0) {
  console.error('Licenses not allowed or missing:');
  for (const c of bad) console.error(`  ${c.name}@${c.version}: ${c.license || '(none)'}`);
  process.exit(1);
}
console.log('All licenses allowed.');
