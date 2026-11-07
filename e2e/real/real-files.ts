// File snapshots for the K9.5 runs: what KumiCraft wrote, without git (a copy may have none).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.kumicraft', 'coverage']);
const MAX_FILE = 2_000_000;

/** Path → sha1 of every source-ish file under `dir` (KumiCraft's own `.kumicraft/` left out). */
function hashOf(bytes: Buffer): string {
  return createHash('sha1').update(bytes).digest('hex');
}

export function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.vite')) {
          walk(join(current, entry.name));
        }
        continue;
      }
      const full = join(current, entry.name);
      // An atomic write's temp file (`App.jsx.123456`) can vanish between listing and reading.
      let bytes: Buffer;
      try {
        if (statSync(full).size > MAX_FILE) continue;
        bytes = readFileSync(full);
      } catch {
        continue;
      }
      const hash = hashOf(bytes);
      out.set(relative(dir, full).replaceAll('\\', '/'), hash);
    }
  };
  walk(dir);
  return out;
}

/** Files that differ from `base`: changed, added or removed. */
export function changedSince(dir: string, base: ReadonlyMap<string, string>): string[] {
  const now = snapshot(dir);
  const paths = new Set([...base.keys(), ...now.keys()]);
  return [...paths].filter((path) => base.get(path) !== now.get(path)).sort();
}

/** The bytes of every file `snapshot` sees, to put the copy back whatever happens in a run. */
export function backup(dir: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  for (const path of snapshot(dir).keys()) {
    try {
      out.set(path, readFileSync(join(dir, path)));
    } catch {
      // Gone between listing and reading: nothing to keep.
    }
  }
  return out;
}

/** Writes back every changed file and removes the files the run added; returns what it fixed. */
export function restore(dir: string, saved: ReadonlyMap<string, Buffer>): string[] {
  const base = new Map([...saved].map(([path, bytes]) => [path, hashOf(bytes)]));
  const fixed = changedSince(dir, base);
  for (const path of fixed) {
    const bytes = saved.get(path);
    if (bytes === undefined) rmSync(join(dir, path), { force: true });
    else writeFileSync(join(dir, path), bytes);
  }
  return fixed;
}
