// `pnpm trace` (SPEC-02 QC-94, SPEC-06 section 6): links rule codes of docs/spec.md to the tests
// that name them in square brackets (QC-93). Fails when a code in scope has no test, when a test
// names a code the spec does not define, or when a code has no phase in trace-scope.json.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SPEC = 'docs/spec.md';
const SCOPE = 'scripts/trace-scope.json';
const SEARCH_ROOTS = ['packages', 'e2e'];
const TEST_FILE = /\.(test\.tsx?|e2e\.ts)$/;
const CODE = String.raw`(?:R-[A-Z]{2}-\d{2}|V-\d{2,3}|S-\d{2,3}[a-z]?|AC-\d{2})`;

const scope = JSON.parse(readFileSync(SCOPE, 'utf8'));
const rules = scope.rules.map((rule) => ({ ...rule, regex: new RegExp(rule.pattern) }));
const phaseOf = (code) => rules.find((rule) => rule.regex.test(code))?.phase;

// Defined codes: first cell of a spec table row, which Prettier may pad with spaces (SPEC-06
// section 6); AC codes come from the SRS and are only referenced.
const specText = readFileSync(SPEC, 'utf8');
const defined = new Set(
  [...specText.matchAll(new RegExp(String.raw`^\| (${CODE}) +\|`, 'gm'))].map((m) => m[1]),
);
for (const m of specText.matchAll(/\bAC-\d{2}\b/g)) defined.add(m[0]);

const testFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === 'node_modules' || entry.name === 'dist' ? [] : testFiles(path);
    return TEST_FILE.test(entry.name) ? [path] : [];
  });

const tested = new Map(); // code -> test files
for (const file of SEARCH_ROOTS.flatMap(testFiles)) {
  const text = readFileSync(file, 'utf8');
  for (const tag of text.matchAll(new RegExp(String.raw`\[(${CODE}(?:,\s*${CODE})*)\]`, 'g'))) {
    for (const code of tag[1].split(/,\s*/)) {
      if (!tested.has(code)) tested.set(code, new Set());
      tested.get(code).add(relative('.', file).replaceAll('\\', '/'));
    }
  }
}

const problems = [];
for (const code of tested.keys()) {
  if (!defined.has(code)) problems.push(`test names ${code}, which docs/spec.md does not define`);
}
const inScope = [...defined].filter((code) => {
  const phase = phaseOf(code);
  if (phase === undefined) problems.push(`${code} has no phase in ${SCOPE}`);
  return phase !== undefined && phase <= scope.currentPhase;
});
const untested = inScope.filter((code) => !tested.has(code)).sort();
for (const code of untested) problems.push(`${code} (phase ${phaseOf(code)}) has no test`);

const covered = inScope.length - untested.length;
console.log(
  `trace: phase ${scope.currentPhase}, ${covered}/${inScope.length} codes in scope have tests; ` +
    `${tested.size} codes named by tests, ${defined.size} defined in the spec.`,
);
if (problems.length > 0) {
  console.error(`  ${problems.join('\n  ')}`);
  process.exitCode = 1;
}
