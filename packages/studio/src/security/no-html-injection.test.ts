// @vitest-environment node
// The lint rule that keeps HTML injection out of the Studio (S-13), checked on real code.
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const studioFile = fileURLToPath(new URL('../app/app.tsx', import.meta.url));

async function ruleIdsFor(code: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: repoRoot });
  const [result] = await eslint.lintText(code, { filePath: studioFile });
  return (result?.messages ?? []).map((m) => m.ruleId ?? '');
}

describe('HTML injection in the Studio [S-13]', () => {
  it('rejects innerHTML, insertAdjacentHTML and document.write', async () => {
    const ids = await ruleIdsFor(
      [
        "const box = document.createElement('div');",
        "box.innerHTML = '<b>x</b>';",
        "box.insertAdjacentHTML('beforeend', '<i>y</i>');",
        "document.write('<p>z</p>');",
        'export const unused = box;',
        '',
      ].join('\n'),
    );

    expect(ids.filter((id) => id === 'no-restricted-properties')).toHaveLength(3);
  }, 60_000);

  it('rejects dangerouslySetInnerHTML in JSX', async () => {
    const ids = await ruleIdsFor(
      [
        'export function Raw({ html }: { readonly html: string }) {',
        '  return <div dangerouslySetInnerHTML={{ __html: html }} />;',
        '}',
        '',
      ].join('\n'),
    );

    expect(ids).toContain('no-restricted-syntax');
  }, 60_000);
});
