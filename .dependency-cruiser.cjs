// Dependency rules of the architecture (docs/architecture/03-kien-truc-dich.md section 6, ADR-A6),
// checked by machine on every `pnpm lint`. Violations that existed when a rule was turned on are
// listed in .dependency-cruiser-known-violations.json; that list may only shrink.
const SERVER = '^packages/server/src/';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Modules form a tree: a cycle makes one change ripple everywhere (03 section 6).',
      severity: 'error',
      from: { path: '^packages/(server|studio)/src/' },
      to: { circular: true },
    },
    {
      name: 'kernel-is-pure',
      comment: 'The kernel uses only shared contracts and ports (03 section 6.1).',
      severity: 'error',
      from: { path: `${SERVER}kernel/` },
      to: { path: SERVER, pathNot: `${SERVER}(kernel|ports)/` },
    },
    {
      name: 'ports-are-interfaces',
      comment: 'Ports are interfaces; they use only kernel types.',
      severity: 'error',
      from: { path: `${SERVER}ports/` },
      to: { path: SERVER, pathNot: `${SERVER}(kernel|ports)/` },
    },
    {
      name: 'lib-is-generic',
      comment:
        'lib holds technology-neutral helpers (JS/TS parsing); it knows no service or stack.',
      severity: 'error',
      from: { path: `${SERVER}lib/` },
      to: { path: `${SERVER}(services|stacks|adapters)/` },
    },
    {
      name: 'services-not-stacks',
      comment:
        'Services reach a technology only through kernel interfaces, wired in index.ts (03 6.1).',
      severity: 'error',
      from: { path: `${SERVER}services/` },
      to: { path: `${SERVER}(stacks|adapters)/` },
    },
    {
      name: 'stacks-not-services',
      comment: 'A stack implements kernel interfaces; it never calls services or adapters.',
      severity: 'error',
      from: { path: `${SERVER}stacks/` },
      to: { path: `${SERVER}(services|adapters)/` },
    },
    {
      name: 'stacks-apart',
      comment:
        'A stack does not use another stack, except the JSX view using the style stack (03 6.1).',
      severity: 'error',
      from: { path: `${SERVER}stacks/([^/]+/[^/]+|style)/` },
      to: {
        path: `${SERVER}stacks/`,
        pathNot: [`${SERVER}stacks/$1/`, `${SERVER}stacks/style/`],
      },
    },
    {
      name: 'style-not-view',
      comment: 'The style stack works for every view language, so it knows none of them.',
      severity: 'error',
      from: { path: `${SERVER}stacks/style/` },
      to: { path: `${SERVER}stacks/view/` },
    },
    {
      name: 'adapters-not-stacks',
      comment: 'HTTP and other adapters call services and kernel interfaces, never a stack.',
      severity: 'error',
      from: { path: `${SERVER}adapters/` },
      to: { path: `${SERVER}stacks/` },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: [
        'node_modules',
        '\\.test\\.tsx?$',
        'test-support',
        '\\.bench\\.ts$',
        '\\.generated\\.ts$',
      ],
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.js', '.mjs'] },
  },
};
