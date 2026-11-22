import { describe, expect, it } from 'vitest';

import { listVariables, removeVariable, setVariable } from './variable-edit.ts';

describe('variable-edit [R-ST-11]', () => {
  it('[R-ST-11] set variable in :root ignores comments and local declarations in other rules', () => {
    const input = [
      '/* --brand-blue: #old; */',
      '.dark {',
      '  --brand-blue: #000;',
      '}',
      ':root {',
      '  --brand-blue: #1d4ed8;',
      '}',
    ].join('\n');

    const result = setVariable(input, 'index.css', 'root', '--brand-blue', '#2563eb');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toContain('/* --brand-blue: #old; */');
    expect(result.value).toContain('.dark {\n  --brand-blue: #000;\n}');
    expect(result.value).toContain(':root {\n  --brand-blue: #2563eb;\n}');
  });

  it('[R-ST-11] set variable in Sass modifies top-level declaration and preserves !default', () => {
    const input = [
      '// $brand: #000;',
      '.a {',
      '  $brand: red;',
      '}',
      '$brand: #e11d48 !default;',
    ].join('\n');

    const result = setVariable(input, 'main.scss', 'sass', '$brand', '#2563eb');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toContain('// $brand: #000;');
    expect(result.value).toContain('.a {\n  $brand: red;\n}');
    expect(result.value).toContain('$brand: #2563eb !default;');
  });

  it('[R-ST-11] remove variable in Less only targets top-level and deletes full line in CRLF file', () => {
    const input = [
      '.a {',
      '  @brand: red;',
      '}',
      '@brand: #e11d48;',
      '.card {',
      '  padding: 12px;',
      '}',
    ].join('\r\n');

    const listed = listVariables(input, 'main.less', 'less');
    expect(listed).toHaveLength(1);
    expect(listed[0]?.variable).toBe('@brand');
    expect(listed[0]?.value).toBe('#e11d48');

    const result = removeVariable(input, 'main.less', 'less', '@brand');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expected = ['.a {', '  @brand: red;', '}', '.card {', '  padding: 12px;', '}'].join(
      '\r\n',
    );
    expect(result.value).toBe(expected);
  });

  it('[R-ST-11][R-TH-11] set variable on file with BOM preserves BOM and applies edit at correct offset', () => {
    const body = [':root {', '  --brand-blue: #1d4ed8;', '}'].join('\n');
    const input = `\uFEFF${body}`;

    const result = setVariable(input, 'index.css', 'root', '--brand-blue', '#2563eb');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.startsWith('\uFEFF')).toBe(true);
    expect(result.value).toBe(`\uFEFF:root {\n  --brand-blue: #2563eb;\n}`);
  });
});
