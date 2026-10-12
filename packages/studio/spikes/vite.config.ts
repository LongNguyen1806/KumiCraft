// Spikes of SPEC-01.2 section 13 (VG-11, VG-14): pages run by scripts/vg/*.mjs with the real
// libraries of the Studio. Never part of the Studio build.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: here('.'),
  base: './',
  plugins: [react()],
  build: {
    outDir: here('dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        ['vg-11', 'vg-14']
          .map((name) => [name, here(`${name}/index.html`)] as const)
          .filter(([, page]) => existsSync(page)),
      ),
    },
  },
});
