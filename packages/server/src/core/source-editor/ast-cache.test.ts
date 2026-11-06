// R-SE-16: the AST cache by (file, hash), least recently used out past 50 files (K9 C5).
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as helpers from './ast-helpers.ts';
import { AST_CACHE_SIZE, cachedAstFiles, getCachedAst } from './source-editor-lookup.ts';

vi.mock('./ast-helpers.ts', { spy: true });

afterEach(() => {
  vi.mocked(helpers.parseJsxAst).mockClear();
});

const code = (n: number) => `export const A${String(n)} = () => <div>{${String(n)}}</div>;\n`;

describe('AST cache [WP-4.00, R-SE-16]', () => {
  it('C5: the same file with the same hash parses once; a new hash parses again [WP-4.00]', () => {
    const parse = vi.mocked(helpers.parseJsxAst);
    const first = getCachedAst('c5/same.tsx', code(1), 'h1');
    expect(getCachedAst('c5/same.tsx', code(1), 'h1')).toBe(first);
    expect(parse).toHaveBeenCalledTimes(1);
    getCachedAst('c5/same.tsx', code(2), 'h2');
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it('C5: past 50 files the least recently used goes, not the first one read [WP-4.00]', () => {
    const parse = vi.mocked(helpers.parseJsxAst);
    getCachedAst('c5/keep.tsx', code(0), 'k');
    getCachedAst('c5/drop.tsx', code(0), 'd');
    for (let n = 0; n < AST_CACHE_SIZE - 2; n++) getCachedAst(`c5/f${String(n)}.tsx`, code(n), 'x');
    // Reading keep.tsx again makes drop.tsx the oldest.
    getCachedAst('c5/keep.tsx', code(0), 'k');
    parse.mockClear();
    getCachedAst('c5/new.tsx', code(99), 'n');

    const files = cachedAstFiles();
    expect(files).toHaveLength(AST_CACHE_SIZE);
    expect(files).not.toContain('c5/drop.tsx');
    expect(files).toContain('c5/keep.tsx');
    getCachedAst('c5/keep.tsx', code(0), 'k');
    expect(parse).toHaveBeenCalledTimes(1);
  });
});
