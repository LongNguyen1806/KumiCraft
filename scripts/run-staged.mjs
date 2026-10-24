// Pre-commit runner (SPEC-02 section 11.3): Prettier or ESLint on the staged files, in batches.
// Passing every staged path on one command line breaks on Windows (cmd stops near 8,000
// characters), which a large commit such as a rename easily passes.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const BATCH = 50;
const TOOLS = {
  format: {
    pkg: 'prettier',
    bin: 'bin/prettier.cjs',
    args: ['--write', '--ignore-unknown'],
    pattern: /\.(ts|tsx|js|json|md|css)$/,
    exclude: [],
  },
  // Templates and fixtures are whole projects with their own ESLint config (eslint.config.js).
  lint: {
    pkg: 'eslint',
    bin: 'bin/eslint.js',
    args: [],
    pattern: /\.(ts|tsx)$/,
    exclude: [/^templates\//, /^fixtures\//],
  },
};

const tool = TOOLS[process.argv[2] ?? ''];
if (tool === undefined) {
  console.error('usage: node scripts/run-staged.mjs <format|lint>');
  process.exit(2);
}

const staged = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], {
  encoding: 'utf8',
});
if (staged.status !== 0) process.exit(staged.status ?? 1);
const files = staged.stdout
  .split('\0')
  .filter((f) => f !== '' && tool.pattern.test(f) && !tool.exclude.some((re) => re.test(f)));

const pkgJson = createRequire(import.meta.url).resolve(`${tool.pkg}/package.json`);
const bin = join(dirname(pkgJson), tool.bin);
let failed = false;
for (let i = 0; i < files.length; i += BATCH) {
  const batch = files.slice(i, i + BATCH);
  const run = spawnSync(process.execPath, [bin, ...tool.args, ...batch], { stdio: 'inherit' });
  if (run.status !== 0) failed = true;
  // Prettier's fixes go into this commit, as lefthook's stage_fixed did.
  if (process.argv[2] === 'format') spawnSync('git', ['add', '--', ...batch], { stdio: 'inherit' });
}
process.exit(failed ? 1 : 0);
