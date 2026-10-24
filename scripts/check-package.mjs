// Verifies the packed `artifacts/*.tgz` tarball before release (R-CL-03, S-96).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const MAX_SOURCEMAP_BYTES = 1024 * 1024;
const TEXT_PATHS = new Set([
  'package/package.json',
  'package/dist/index.js',
  'package/dist/runners/vite-react.js',
  'package/dist/templates/vite-react-ts-tailwind4/package.json',
  'package/dist/templates/vite-react-ts-tailwind4/src/App.tsx',
  'package/dist/templates/vite-react-ts-tailwind4/src/pages/Home.tsx',
]);

function checkManifest(filesSet, contents) {
  const raw = contents['package/package.json'];
  if (!filesSet.has('package/package.json') || typeof raw !== 'string') {
    return { ok: false, reason: 'package.json', error: 'Missing package/package.json' };
  }
  let pkg;
  try {
    pkg = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'package.json', error: 'Invalid JSON in package/package.json' };
  }
  const scripts = pkg.scripts ?? {};
  for (const hook of ['postinstall', 'preinstall', 'install']) {
    if (scripts[hook] !== undefined) {
      return {
        ok: false,
        reason: 'postinstall',
        error: `Forbidden lifecycle script "${hook}" in package/package.json`,
      };
    }
  }
  const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.kumicraft;
  if (typeof binRel !== 'string') {
    return { ok: false, reason: 'bin', error: 'Missing bin.kumicraft in package/package.json' };
  }
  const binPath = `package/${binRel.replace(/^\.\//, '')}`;
  const binText = contents[binPath] ?? '';
  if (!filesSet.has(binPath) || !binText.startsWith('#!/usr/bin/env node')) {
    return {
      ok: false,
      reason: 'bin',
      error: `${binPath} is missing or does not start with #!/usr/bin/env node`,
    };
  }
  return { ok: true, check: `bin (${binPath}) + no install hooks` };
}

function checkBundledAssets(files, filesSet, contents) {
  const hasStudioHtml = filesSet.has('package/dist/studio/index.html');
  const hasStudioAsset = files.some(
    (f) => f.startsWith('package/dist/studio/assets/') && (f.endsWith('.js') || f.endsWith('.css')),
  );
  if (!hasStudioHtml || !hasStudioAsset) {
    return {
      ok: false,
      reason: 'studio',
      error: 'Missing built Studio (package/dist/studio/index.html or assets)',
    };
  }

  const runnerPath = 'package/dist/runners/vite-react.js';
  const runnerText = contents[runnerPath] ?? '';
  const hasBridge =
    runnerText.includes('data-rc-id') ||
    runnerText.includes('data-rc-loc') ||
    runnerText.includes('BRIDGE_CLIENT_CODE');
  if (!filesSet.has(runnerPath) || !hasBridge) {
    return {
      ok: false,
      reason: 'bridge',
      error: 'Missing Bridge client code in package/dist/runners/vite-react.js',
    };
  }

  const tplPkg = 'package/dist/templates/vite-react-ts-tailwind4/package.json';
  const tplEntries = [
    'package/dist/templates/vite-react-ts-tailwind4/src/App.tsx',
    'package/dist/templates/vite-react-ts-tailwind4/src/pages/Home.tsx',
  ];
  const tplEntry = tplEntries.find((p) => filesSet.has(p));
  const appText = tplEntry === undefined ? '' : (contents[tplEntry] ?? '');
  if (!filesSet.has(tplPkg) || tplEntry === undefined || !appText.includes('Oakline')) {
    return {
      ok: false,
      reason: 'template',
      error: 'Missing project template files or Oakline marker',
    };
  }
  return { ok: true, check: 'Studio, Bridge and project template present' };
}

function checkForbiddenFiles(files, sizes) {
  for (const file of files) {
    if (/(^|\/)node_modules\//.test(file)) {
      return { ok: false, reason: 'node_modules', error: `Forbidden node_modules entry: ${file}` };
    }
    if (/\.(test|spec)\.[^/]+$/.test(file)) {
      return { ok: false, reason: 'test', error: `Forbidden test file in package: ${file}` };
    }
    if (/^package\/src\//.test(file)) {
      return { ok: false, reason: 'src', error: `Forbidden raw src/ file in package: ${file}` };
    }
    if (file.endsWith('.map') && (sizes[file] ?? 0) > MAX_SOURCEMAP_BYTES) {
      return { ok: false, reason: 'sourcemap', error: `Oversized source map (> 1 MB): ${file}` };
    }
  }
  return { ok: true, check: 'No forbidden files (node_modules, tests, raw src, large maps)' };
}

export function checkPackage(input) {
  const files = input.files ?? [];
  const contents = input.contents ?? {};
  const sizes = input.sizes ?? {};
  const filesSet = new Set(files);

  const steps = [
    checkManifest(filesSet, contents),
    checkBundledAssets(files, filesSet, contents),
    checkForbiddenFiles(files, sizes),
  ];
  const failed = steps.find((step) => !step.ok);
  if (failed !== undefined) {
    return {
      ok: false,
      reason: failed.reason,
      errors: steps.filter((s) => !s.ok).map((s) => s.error),
    };
  }
  return { ok: true, checks: steps.map((s) => s.check) };
}

function readTarString(buf, start, length) {
  let end = start;
  const max = start + length;
  while (end < max && buf[end] !== 0) end += 1;
  return buf.subarray(start, end).toString('utf8');
}

export function readTgzPackage(tgzPath) {
  const tar = gunzipSync(readFileSync(tgzPath));
  const files = [];
  const contents = {};
  const sizes = {};
  let offset = 0;
  let paxPath;

  while (offset + 512 <= tar.length) {
    if (tar[offset] === 0) break;
    const name = readTarString(tar, offset, 100);
    const sizeOctal = readTarString(tar, offset + 124, 12).trim();
    const size = sizeOctal === '' ? 0 : Number.parseInt(sizeOctal, 8);
    const typeFlag = String.fromCharCode(tar[offset + 156] ?? 0);
    const prefix = readTarString(tar, offset + 345, 155);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;

    if (typeFlag === 'x' || typeFlag === 'g') {
      const pax = tar.subarray(dataStart, dataEnd).toString('utf8');
      const match = /\d+ path=([^\n]+)\n/.exec(pax);
      if (match?.[1] !== undefined) paxPath = match[1];
    } else if (typeFlag === '0' || typeFlag === '\0') {
      const fullPath = paxPath ?? (prefix ? `${prefix}/${name}` : name);
      paxPath = undefined;
      files.push(fullPath);
      sizes[fullPath] = size;
      if (TEXT_PATHS.has(fullPath)) {
        contents[fullPath] = tar.subarray(dataStart, dataEnd).toString('utf8');
      }
    } else {
      paxPath = undefined;
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return { files, contents, sizes };
}

function findNewestTgz(artifactsDir) {
  if (!existsSync(artifactsDir)) return undefined;
  const entries = readdirSync(artifactsDir)
    .filter((name) => name.endsWith('.tgz'))
    .map((name) => {
      const full = join(artifactsDir, name);
      return { full, mtimeMs: statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return entries[0]?.full;
}

function runCli() {
  const artifactsDir = resolve(process.cwd(), 'artifacts');
  const tgzPath = findNewestTgz(artifactsDir);
  if (tgzPath === undefined) {
    console.error('check-package: no .tgz found in artifacts/. Run `pnpm package` first.');
    process.exit(1);
  }
  const pkgData = readTgzPackage(tgzPath);
  const result = checkPackage(pkgData);
  if (!result.ok) {
    console.error(`check-package FAILED (${tgzPath}):`);
    for (const err of result.errors) console.error(`  - ${err}`);
    process.exit(1);
  }
  console.log(`check-package OK (${tgzPath}, ${String(pkgData.files.length)} files):`);
  for (const item of result.checks) console.log(`  - ${item}`);
}

const isMain =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  runCli();
}
