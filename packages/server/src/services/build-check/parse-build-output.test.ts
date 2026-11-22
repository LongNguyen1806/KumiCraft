// Reading build tool output (K9 C2, C4; M-BC, S-86).
import { describe, expect, it } from 'vitest';

import {
  parsePugOutput,
  parseTscOutput,
  parseViteOutput,
  relativeToRoot,
} from './parse-build-output.ts';

const ROOT = 'D:/work/app';
const ESC = String.fromCharCode(27);

describe('build output parsers [WP-4.00, M-BC]', () => {
  it('C2: tsc lines become problems; indented lines continue the message; global errors keep no file [WP-4.00]', () => {
    const out = [
      "src/x.tsx(3,7): error TS2322: Type 'string' is not assignable to type 'number'.",
      "  Types of property 'a' are incompatible.",
      'D:\\work\\app\\src\\y.ts(10,1): error TS1005: ";" expected.',
      'error TS5083: Cannot read file tsconfig.base.json.',
      'C:/elsewhere/lib.d.ts(1,1): error TS2300: Duplicate identifier.',
    ].join('\r\n');
    expect(parseTscOutput(out, ROOT)).toEqual([
      {
        source: 'tsc',
        file: 'src/x.tsx',
        line: 3,
        column: 7,
        message:
          "TS2322: Type 'string' is not assignable to type 'number'. Types of property 'a' are incompatible.",
      },
      { source: 'tsc', file: 'src/y.ts', line: 10, column: 1, message: 'TS1005: ";" expected.' },
      { source: 'tsc', message: 'TS5083: Cannot read file tsconfig.base.json.' },
      { source: 'tsc', message: 'C:/elsewhere/lib.d.ts: TS2300: Duplicate identifier.' },
    ]);
  });

  it('C2: Vite 7 output (message + file: line, colours) gives file, line and column [WP-4.00]', () => {
    const out = [
      `${ESC}[31m✗${ESC}[39m Build failed in 77ms`,
      `${ESC}[31merror during build:`,
      '[vite:build-html] Transform failed with 1 error:',
      `${ESC}[31mfile: ${ESC}[36mD:/work/app/src/main.ts:1:10 (D:/work/app/index.html)${ESC}[31m`,
      '    at failureErrorWithLog (D:/x/esbuild/main.js:1:1)',
    ].join('\n');
    expect(parseViteOutput(out, ROOT)).toEqual([
      {
        source: 'vite',
        file: 'src/main.ts',
        line: 1,
        column: 10,
        message: '[vite:build-html] Transform failed with 1 error:',
      },
    ]);
  });

  it('C2: Vite 8 output gives one problem per [CODE] error with its framed location [WP-4.00]', () => {
    const out = [
      'error during build:',
      'Build failed with 2 errors:',
      '',
      `${ESC}[31m[UNRESOLVED_IMPORT] ${ESC}[0mCould not resolve './nope.ts' in src/main.ts`,
      `   ${ESC}[38;5;246m╭─[ src/main.ts:2:8 ]`,
      '   │',
      ' 2 │ import "./nope.ts";',
      '   │        ─────┬─────',
      '[PARSE_ERROR] Unexpected token',
      '   ╭─[ src/App.tsx:5:3 ]',
      '    at aggregateBindingErrorsIntoJsError (file:///x/rolldown.mjs:49:18)',
    ].join('\n');
    expect(parseViteOutput(out, ROOT)).toEqual([
      {
        source: 'vite',
        file: 'src/main.ts',
        line: 2,
        column: 8,
        message: "[UNRESOLVED_IMPORT] Could not resolve './nope.ts' in src/main.ts",
      },
      {
        source: 'vite',
        file: 'src/App.tsx',
        line: 5,
        column: 3,
        message: '[PARSE_ERROR] Unexpected token',
      },
    ]);
  });

  it('C2: Vite output without the header (crash) is one problem with its first lines [WP-4.00]', () => {
    expect(parseViteOutput('\nfailed to load config from vite.config.ts\nboom\n', ROOT)).toEqual([
      { source: 'vite', message: 'failed to load config from vite.config.ts boom' },
    ]);
    expect(parseViteOutput('', ROOT)).toEqual([]);
  });

  it('C2: the Pug check JSON line maps to problems; anything else is unreadable [WP-4.00]', () => {
    const out = `noise\n${JSON.stringify({ errors: [{ file: 'views/x.pug', line: 2, column: 11, message: 'Syntax Error' }] })}\n`;
    expect(parsePugOutput(out, ROOT)).toEqual([
      { source: 'pug', file: 'views/x.pug', line: 2, column: 11, message: 'Syntax Error' },
    ]);
    expect(parsePugOutput('{ not json', ROOT)).toBeUndefined();
    expect(parsePugOutput('no json at all', ROOT)).toBeUndefined();
  });

  it('C2: paths outside the project or climbing out of it are not opened [WP-4.00]', () => {
    expect(relativeToRoot(ROOT, 'd:/WORK/app/src/a.ts')).toBe('src/a.ts');
    expect(relativeToRoot(ROOT, './src/a.ts')).toBe('src/a.ts');
    expect(relativeToRoot(ROOT, 'D:/work/app-other/a.ts')).toBeUndefined();
    expect(relativeToRoot(ROOT, '../secret.ts')).toBeUndefined();
    expect(relativeToRoot('/home/u/app', '/home/u/app/src/a.ts')).toBe('src/a.ts');
    expect(relativeToRoot('/home/u/app', '/home/U/app/src/a.ts')).toBeUndefined();
  });

  it('C4: 40,000 tsc errors parse 200 in full and count the rest for the total [WP-4.00]', () => {
    const out = 'src/a.ts(1,2): error TS1005: x\n'.repeat(40_000);
    const started = performance.now();
    const problems = parseTscOutput(out, ROOT);
    expect(performance.now() - started).toBeLessThanOrEqual(100);
    expect(problems).toHaveLength(40_000);
    expect(problems[199]).toMatchObject({ file: 'src/a.ts', line: 1, column: 2 });
  });

  it('C4: 1 MB of garbage output is read in ≤ 100 ms per parser without hanging (S-86) [WP-4.00]', () => {
    const oneLine = `${'('.repeat(300_000)}${'a1,'.repeat(150_000)}${'[ x:'.repeat(62_500)}`;
    const manyLines = 'src/a.ts(1,\n file: x:\n╭─[ \n'.repeat(40_000);
    for (const garbage of [oneLine, manyLines]) {
      expect(garbage.length).toBeGreaterThanOrEqual(1_000_000);
      const withHeader = `error during build:\n${garbage}`;
      for (const run of [
        () => parseTscOutput(garbage, ROOT),
        () => parseViteOutput(withHeader, ROOT),
        () => parsePugOutput(garbage, ROOT),
      ]) {
        const started = performance.now();
        run();
        expect(performance.now() - started).toBeLessThanOrEqual(100);
      }
    }
  });
});
