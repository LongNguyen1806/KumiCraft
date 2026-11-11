// A component that always draws itself stops with a message instead of hanging the page and, on
// Safari, the Studio (spec-log #116).
import { parse } from '@babel/parser';
import { describe, expect, it } from 'vitest';

import { transformJsx } from './transform-jsx.ts';

const OPTIONS = { rootDir: '/p', sourceDir: 'src' };
const run = (code: string) =>
  transformJsx(code, '/p/src/layouts/MainLayout.tsx', OPTIONS)?.code ?? '';
const reparses = (code: string) =>
  parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] }).program.body.length > 0;

describe('guardSelfRender', () => {
  it('stops MainLayout drawn inside MainLayout, with the file and line in the message', () => {
    const out = run(`export function MainLayout() {
  return (
    <div>
      <main>
        <MainLayout />
      </main>
    </div>
  );
}
`);
    expect(out).toContain('throw new Error(');
    expect(out).toContain('<MainLayout> draws itself');
    expect(out).toContain('src/layouts/MainLayout.tsx:5');
    expect(reparses(out)).toBe(true);
  });

  it('wraps a component that returns itself directly, in an arrow and in a return', () => {
    const arrow = run('export const Loop = () => <Loop />;\n');
    const ret = run('export function Again() {\n  const a = 1;\n  return <Again n={a} />;\n}\n');
    for (const out of [arrow, ret]) {
      expect(out).toContain('throw new Error(');
      expect(reparses(out)).toBe(true);
    }
  });

  it.each([
    [
      'behind a condition',
      'function Tree({ n }) { return <div>{n > 0 && <Tree n={n - 1} />}</div>; }',
    ],
    [
      'in a loop',
      'function Tree({ kids }) { return <ul>{kids.map((k) => <Tree kids={k} />)}</ul>; }',
    ],
    [
      'after an early return',
      'function Tree({ n }) { if (n === 0) return <p />; return <div><Tree n={n - 1} /></div>; }',
    ],
    ['inside a ternary', 'function Tree({ n }) { return n ? <Tree n={n - 1} /> : <p />; }'],
    ['as another component', 'function Card() { return <div><Header /></div>; }'],
  ])('leaves a real recursion or an ordinary component alone (%s)', (_case, code) => {
    expect(run(`export ${code}\n`)).not.toContain('throw new Error(');
  });
});
