// SPEC-02 section 11.2, QC-76
const TYPES = [
  'feat',
  'fix',
  'refactor',
  'test',
  'docs',
  'spec',
  'chore',
  'perf',
  'build',
  'ci',
  'spike',
];

const SCOPES = [
  'shared',
  'server',
  'bridge',
  'studio',
  'cli',
  'e2e',
  'fixtures',
  'templates',
  'repo',
  'docs',
];

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', TYPES],
    'scope-enum': [2, 'always', SCOPES],
    'scope-empty': [2, 'never'],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 72],
    'header-max-length': [2, 'always', 100],
  },
};
