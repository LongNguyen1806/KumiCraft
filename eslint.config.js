// @ts-check
// ESLint flat config. Rules come from SPEC-01 ADR-BE-27, SPEC-01 section 3.2 and SPEC-02 (QC-xx).
// Studio rules (ADR-FE-19): react-hooks, jsx-a11y and the layering rules of SPEC-01 section 3.2.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import i18next from 'eslint-plugin-i18next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

const TS_FILES = ['**/*.ts', '**/*.tsx'];
const JS_FILES = ['**/*.js', '**/*.mjs'];

/** QC-03: other packages are imported only through their public entry point. */
const NO_DEEP_PACKAGE_IMPORT = {
  group: ['@kumicraft/*/src', '@kumicraft/*/src/**'],
  message: 'Import from the package entry point only (QC-03).',
};

const RESTRICTED_SYNTAX = [
  {
    selector: 'TSEnumDeclaration',
    message: 'Do not use enum. Use a string union or an `as const` object (QC-38).',
  },
  {
    selector: 'TSNullKeyword',
    message: 'Use undefined instead of null (QC-40).',
  },
  {
    selector: "Literal[raw='null']",
    message: 'Use undefined instead of null (QC-40).',
  },
  {
    selector: "CallExpression[callee.property.name='then']",
    message: 'Use async/await instead of .then() chains (QC-42).',
  },
];

const NO_PROCESS_EXIT = {
  object: 'process',
  property: 'exit',
  message: 'Only packages/cli may call process.exit() (QC-52).',
};

// S-13: the Studio never turns strings into HTML; React escapes everything it renders (S-14).
const HTML_INJECTION_MESSAGE = 'Do not inject HTML; render text through React (S-13).';
const NO_HTML_INJECTION_JSX = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  message: HTML_INJECTION_MESSAGE,
};
const NO_HTML_INJECTION_PROPERTIES = [
  { property: 'innerHTML', message: HTML_INJECTION_MESSAGE },
  { property: 'outerHTML', message: HTML_INJECTION_MESSAGE },
  { property: 'insertAdjacentHTML', message: HTML_INJECTION_MESSAGE },
  { object: 'document', property: 'write', message: HTML_INJECTION_MESSAGE },
  { object: 'document', property: 'writeln', message: HTML_INJECTION_MESSAGE },
];

const NO_DEFAULT_EXPORT = {
  selector: 'ExportDefaultDeclaration',
  message: 'Use named exports only (QC-37).',
};

export default defineConfig(
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/coverage/',
    'docs/',
    'fixtures/',
    'templates/',
    'packages/bridge/src/client/bridge-client.generated.ts',
  ]),

  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },

  // Rules shared by every source file.
  {
    files: [...TS_FILES, ...JS_FILES],
    extends: [js.configs.recommended],
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error', // QC-43
      'simple-import-sort/exports': 'error',
      'no-console': 'error', // ADR-BE-23: log through LoggerPort
      'no-empty': ['error', { allowEmptyCatch: false }], // QC-49
      'no-restricted-imports': ['error', { patterns: [NO_DEEP_PACKAGE_IMPORT] }],
      'no-restricted-properties': ['error', NO_PROCESS_EXIT],
      'no-restricted-syntax': ['error', NO_DEFAULT_EXPORT, ...RESTRICTED_SYNTAX],
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }], // QC-44
      'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
    },
  },

  // TypeScript: type-aware rules (ADR-BE-27).
  {
    files: TS_FILES,
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error', // QC-43
      // `const { a, ...rest } = x` is the idiom for dropping fields.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' }, // ADR-BE-02
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^I[A-Z]', match: false }, // QC-21
        },
      ],
    },
  },

  // Plain JavaScript (tool configs, scripts): Node globals, no type information.
  {
    files: JS_FILES,
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
    },
  },

  // SPEC-01 section 3.2 rule 2: shared runs in Node and in the browser, with zod only.
  {
    files: ['packages/shared/src/**/*.ts'],
    ignores: ['packages/shared/src/**/*.test.ts', 'packages/shared/src/**/*.bench.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            NO_DEEP_PACKAGE_IMPORT,
            {
              regex: '^(?!zod(?:/|$)|\\.{1,2}/).*',
              message:
                '@kumicraft/shared may import only zod and its own files (SPEC-01 section 3.2).',
            },
          ],
        },
      ],
    },
  },

  // 03 section 3.3 and 5: pure packages; they run in Node and in the browser, without I/O.
  {
    files: ['packages/style-tailwind/src/**/*.ts'],
    ignores: ['packages/style-tailwind/src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            NO_DEEP_PACKAGE_IMPORT,
            {
              regex: '^(?!@kumicraft/shared$|\\.{1,2}/).*',
              message:
                '@kumicraft/style-tailwind may import only @kumicraft/shared and its own files (03 section 3.3).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/content/src/**/*.ts'],
    ignores: ['packages/content/src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            NO_DEEP_PACKAGE_IMPORT,
            {
              regex: '^(?!@kumicraft/(shared|style-tailwind)$|\\.{1,2}/).*',
              message:
                '@kumicraft/content may import only @kumicraft/shared, @kumicraft/style-tailwind and its own files (03 section 5).',
            },
          ],
        },
      ],
    },
  },

  // SPEC-01 section 3.2 rule 1 and QC-63: the server core talks to the outside through ports.
  {
    files: ['packages/server/src/{kernel,lib,ports,services,stacks}/**/*.ts'],
    // Integration tests of core services use the real adapters and fixtures.
    ignores: [
      'packages/server/src/{kernel,lib,ports,services,stacks}/**/*.test.ts',
      'packages/server/src/{kernel,lib,ports,services,stacks}/**/test-support.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'fastify',
              message:
                'kernel, services and stacks must not depend on Fastify (SPEC-01 section 3.2).',
            },
            {
              name: 'chokidar',
              message:
                'kernel, services and stacks must use FileWatcherPort (SPEC-01 section 3.2).',
            },
            {
              name: 'node:fs',
              message: 'kernel, services and stacks must use FileSystemPort (QC-63).',
            },
            {
              name: 'node:fs/promises',
              message: 'kernel, services and stacks must use FileSystemPort (QC-63).',
            },
            { name: 'fs', message: 'kernel, services and stacks must use FileSystemPort (QC-63).' },
            {
              name: 'fs/promises',
              message: 'kernel, services and stacks must use FileSystemPort (QC-63).',
            },
          ],
          patterns: [
            NO_DEEP_PACKAGE_IMPORT,
            {
              group: ['**/adapters', '**/adapters/**', '@fastify/*'],
              message:
                'kernel, services and stacks must not import adapters (SPEC-01 section 3.2).',
            },
          ],
        },
      ],
    },
  },

  // Studio: hooks rules, accessibility (QC-58).
  {
    files: ['packages/studio/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], jsxA11y.flatConfigs.recommended],
  },

  // S-13: no HTML injection anywhere in the Studio, tests included.
  {
    files: ['packages/studio/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        NO_DEFAULT_EXPORT,
        ...RESTRICTED_SYNTAX,
        NO_HTML_INJECTION_JSX,
      ],
      'no-restricted-properties': ['error', NO_PROCESS_EXIT, ...NO_HTML_INJECTION_PROPERTIES],
    },
  },

  // ADR-FE-16, VG-12: no user-facing text written in JSX; it goes through t().
  {
    files: ['packages/studio/src/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            include: ['aria-label', 'aria-description', 'title', 'placeholder', 'alt'],
          },
        },
      ],
    },
  },

  // Studio: the server is called only through src/api/.
  {
    files: ['packages/studio/src/**/*.{ts,tsx}'],
    ignores: ['packages/studio/src/api/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'Call the backend through src/api/ only (SPEC-01 section 3.2).',
        },
      ],
    },
  },

  // 03 section 6.2: a feature sends an edit only through core/edits.ts, never the endpoints itself.
  {
    files: ['packages/studio/src/features/**/*.{ts,tsx}'],
    ignores: ['packages/studio/src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            NO_DEEP_PACKAGE_IMPORT,
            {
              group: ['**/api/source-client.ts', '**/api/style-client.ts'],
              importNames: ['editSource', 'editSourceBatch', 'applyStructureEdit', 'applyStyle'],
              message: 'Send edits through core/edits.ts (03 section 6.2).',
            },
          ],
        },
      ],
    },
  },

  // QC-44 targets production functions; a describe() block naturally groups many cases.
  {
    files: ['**/*.test.{ts,tsx}', '**/*.e2e.ts', '**/*.tour.ts', '**/*.bench.ts'],
    rules: { 'max-lines-per-function': 'off' },
  },

  // The CLI, runner scripts, repository scripts and the E2E server launcher are programs of their
  // own: they are allowed to exit and print (QC-52).
  {
    files: [
      'packages/cli/src/**/*.ts',
      'packages/server/src/runners/**/*.ts',
      'scripts/**/*.{mjs,ts}',
      'e2e/support/agent-studio.ts',
    ],
    rules: {
      'no-console': 'off',
      'no-restricted-properties': 'off',
    },
  },

  // Tool configuration files must use a default export (QC-37 exception).
  {
    files: [
      '*.config.js',
      '*.config.ts',
      'tour/*.config.js',
      'packages/*/*.config.js',
      'packages/*/*.config.ts',
      // 03b section 1.2: webpack and Turbopack call a loader module's default export.
      'packages/server/src/runners/next-loader.ts',
    ],
    rules: {
      'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX],
    },
  },
);
