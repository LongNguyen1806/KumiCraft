// Tests for classifyImport (R-CH-02, R-MR-01).
import { describe, expect, it } from 'vitest';

import { classifyImport } from './import-path.ts';

describe('classifyImport [R-CH-02, R-MR-01]', () => {
  it('Situation 1: classifies Windows paths correctly [R-CH-02, R-MR-01]', () => {
    const root = 'D:\\proj';

    expect(classifyImport(root, 'src/pages')).toEqual({ kind: 'doc', relPath: 'src/pages' });
    expect(classifyImport(root, 'D:\\proj\\docs\\a.md')).toEqual({
      kind: 'doc',
      relPath: 'docs/a.md',
    });
    expect(classifyImport(root, 'd:/PROJ/src')).toEqual({ kind: 'doc', relPath: 'src' });
    expect(classifyImport(root, 'D:\\proj')).toEqual({ kind: 'projectRoot' });
    expect(classifyImport(root, 'D:\\proj\\')).toEqual({ kind: 'projectRoot' });
    expect(classifyImport(root, 'D:\\proj-old')).toEqual({
      kind: 'backend',
      path: 'D:\\proj-old',
    });
    expect(classifyImport(root, '..\\api')).toEqual({ kind: 'backend', path: 'D:\\api' });
    expect(classifyImport(root, 'E:\\api')).toEqual({ kind: 'backend', path: 'E:\\api' });
    expect(classifyImport(root, '')).toEqual({ kind: 'invalid' });
    expect(classifyImport(root, '   ')).toEqual({ kind: 'invalid' });
    expect(classifyImport(root, 'src/../../x')).toEqual({ kind: 'backend', path: 'D:\\x' });
  });

  it('Situation 2: classifies POSIX paths case-sensitively [R-CH-02]', () => {
    const root = '/home/a/proj';

    expect(classifyImport(root, '/home/a/proj/src')).toEqual({ kind: 'doc', relPath: 'src' });
    expect(classifyImport(root, '/home/a/Proj/src')).toEqual({
      kind: 'backend',
      path: '/home/a/Proj/src',
    });
    expect(classifyImport(root, '/srv/api')).toEqual({ kind: 'backend', path: '/srv/api' });
    expect(classifyImport(root, './docs')).toEqual({ kind: 'doc', relPath: 'docs' });
  });
});
