// Indentation step used when the Source Editor writes multi-line text (R-SE-09).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { makeTempDir, nodeFs } from '../workspace/test-support.ts';
import { detectIndentation } from './ast-helpers.ts';
import { createSourceEditorService } from './source-editor-service.ts';

const lines = (...text: string[]) => text.join('\n');

describe('detectIndentation [R-SE-09]', () => {
  it('uses a tab when the opening line starts with a tab', () => {
    const code = lines('a', '\t\t<p>', '\t\t\tx', '\t\t</p>', '');

    expect(detectIndentation(code, 4)).toEqual({ useTab: true, step: 1, openingIndent: '\t\t' });
  });

  it('takes the smallest non-zero number of spaces in the file', () => {
    const four = lines('a', '    <p>', '        x', '    </p>', '');
    const two = lines('a', '  <p>', '    x', '  </p>', '');

    expect(detectIndentation(four, 4)).toEqual({ useTab: false, step: 4, openingIndent: '    ' });
    expect(detectIndentation(two, 4)).toEqual({ useTab: false, step: 2, openingIndent: '  ' });
  });

  it('ignores block comment lines and defaults to 2 without indented lines', () => {
    const withDoc = lines('/**', ' * Card', ' */', '    <p>', '        x', '    </p>', '');

    expect(detectIndentation(withDoc, 6).step).toBe(4);
    expect(detectIndentation('<p>x</p>', 1)).toEqual({ useTab: false, step: 2, openingIndent: '' });
  });

  it('writes multi-line text one step in, with the file own step', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      await mkdir(join(dir, 'src'), { recursive: true });
      const file = join(dir, 'src', 'F.tsx');
      await writeFile(
        file,
        lines(
          'export function F() {',
          '    return (',
          '        <p>',
          '            x',
          '        </p>',
          '    );',
          '}',
          '',
        ),
      );
      const service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });

      const res = await service.applyEdit(dir, {
        kind: 'setText',
        loc: 'src/F.tsx:3:9',
        tag: 'p',
        before: 'x',
        after: 'y',
      });

      expect(res.ok).toBe(true);
      expect(await readFile(file, 'utf8')).toBe(
        lines(
          'export function F() {',
          '    return (',
          '        <p>',
          '            y',
          '        </p>',
          '    );',
          '}',
          '',
        ),
      );
    } finally {
      await cleanup();
    }
  });
});
