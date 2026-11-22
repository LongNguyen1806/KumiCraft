// Vitest for the whole repository (ADR-BE-26, ADR-FE-18): one project per package, coverage
// thresholds of SPEC-02 section 9. Tests sit next to their source file (QC-01).
import { defineConfig } from 'vitest/config';

const nodeProject = (name) => ({
  test: {
    name,
    root: `packages/${name}`,
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});

export default defineConfig({
  test: {
    projects: [
      nodeProject('shared'),
      nodeProject('style-tailwind'),
      nodeProject('content'),
      nodeProject('bridge'),
      nodeProject('server'),
      nodeProject('cli'),
      {
        test: {
          name: 'studio',
          root: 'packages/studio',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'happy-dom',
          setupFiles: ['./src/test-setup.ts'],
        },
      },
      {
        test: {
          name: 'scripts',
          include: ['scripts/**/*.test.mjs'],
          environment: 'node',
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}'],
      // Entry points only wire things together; the E2E tests (e2e/) cover them.
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.bench.ts',
        '**/test-support.ts',
        'packages/studio/src/test-setup.ts',
        '**/*.d.ts',
        'packages/studio/src/main.tsx',
        'packages/cli/src/index.ts',
        'packages/bridge/src/client/entry.ts',
        'packages/bridge/src/client/bridge-client.generated.ts',
      ],
      reporter: ['text-summary', 'json-summary', 'html'],
      thresholds: {
        lines: 70,
        'packages/shared/src/**': { lines: 90 },
        'packages/style-tailwind/src/**': { lines: 90 },
        'packages/server/src/{kernel,lib,services,stacks}/**': { lines: 80 },
        'packages/studio/src/store/**': { lines: 80 },
      },
    },
  },
});
