// Bundles the CLI with the internal packages into one ESM file and ships the built Studio next to it
// (ADR-BE-25). Third-party packages stay external and are installed from `dependencies`.
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22.12',
  clean: true,
  dts: false,
  // The package is ESM ("type": "module"), so the bin can be a plain `.js` file.
  fixedExtension: false,
  // Bundling a third-party CommonJS package breaks it in ESM (write-file-atomic reads __filename):
  // only the internal packages may be bundled, so a missing `dependencies` entry fails the build.
  deps: { alwaysBundle: [/^@reactcraft\//], onlyBundle: [/^@reactcraft\//] },
  copy: [{ from: '../studio/dist', to: 'dist', rename: 'studio' }],
});
