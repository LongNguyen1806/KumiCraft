// Bundles the CLI with the internal packages into one ESM file and ships the built Studio next to it
// (ADR-BE-25). Third-party packages stay external and are installed from `dependencies`.
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'runners/vite-react': '../server/src/runners/vite-react.ts',
    'runners/format-snippet': '../server/src/runners/format-snippet.ts',
    'runners/express-pug': '../server/src/runners/express-pug.ts',
  },
  format: 'esm',
  platform: 'node',
  target: 'node22.12',
  clean: true,
  dts: false,
  // The package is ESM ("type": "module"), so the bin can be a plain `.js` file.
  fixedExtension: false,
  // Bundling a third-party CommonJS package breaks it in ESM (write-file-atomic reads __filename):
  // only the internal packages may be bundled, so a missing `dependencies` entry fails the build.
  deps: { alwaysBundle: [/^@kumicraft\//], onlyBundle: [/^@kumicraft\//] },
  copy: [
    { from: '../studio/dist', to: 'dist', rename: 'studio' },
    // ADR-BE-25: the project template ships inside the package (ADR-BE-32).
    { from: '../../templates', to: 'dist', rename: 'templates' },
  ],
});
