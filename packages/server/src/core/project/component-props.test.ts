// Props of an extracted component (FR-72): JavaScript without types, TypeScript with the types
// the project's TypeScript reads; a type only declared in the old file gets exported there.
import { ok } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import { asAstNode, type AstNode, parseJsxAst } from '../source-editor/ast-helpers.ts';
import { planProps, type PropTypesPort } from './component-props.ts';

const SOURCE = `import { Badge } from './Badge.tsx';

type Item = { readonly id: number };

export function List({ items }: { items: Item[] }) {
  const open = true;
  return <ul>{open && items.map((i) => <li key={i.id}><Badge /></li>)}</ul>;
}
`;

function context(typescript: boolean) {
  const sourceAst = parseJsxAst(SOURCE);
  const start = SOURCE.indexOf('<ul>');
  const find = (node: unknown): AstNode | undefined => {
    const ast = asAstNode(node);
    if (!ast) return undefined;
    if (ast.type === 'JSXElement' && ast.start === start) return ast;
    for (const value of Object.values(ast)) {
      for (const item of Array.isArray(value) ? value : [value]) {
        if (item !== undefined && typeof item === 'object') {
          const found = find(item);
          if (found !== undefined) return found;
        }
      }
    }
    return undefined;
  };
  const targetNode = find(sourceAst);
  if (targetNode === undefined) throw new Error('no <ul>');
  return {
    name: 'ItemList',
    sourceAst,
    sourceCode: SOURCE,
    sourceRel: 'src/pages/List.tsx',
    newFileRel: 'src/components/ItemList.tsx',
    targetNode,
    props: ['open', 'items'],
    typescript,
  };
}

describe('planProps [WP-4.00, FR-72]', () => {
  it('JavaScript: the names become destructured props and attributes of the same name', async () => {
    const plan = await planProps(context(false), undefined);
    expect(plan).toEqual(
      ok({
        signature: '{ open, items }',
        typeImports: [],
        exportAt: [],
        usage: ' open={open} items={items}',
      }),
    );
  });

  it('TypeScript: a type only declared in the old file is exported there and imported', async () => {
    const seen: { name: string; offset: number }[] = [];
    const port: PropTypesPort = (request) => {
      seen.push(...request.names);
      return Promise.resolve(ok(['boolean', 'Item[]']));
    };
    const plan = await planProps(context(true), port);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(seen.map((n) => [n.name, SOURCE.slice(n.offset, n.offset + n.name.length)])).toEqual([
      ['open', 'open'],
      ['items', 'items'],
    ]);
    expect(plan.value.typeDecl).toBe(
      'type ItemListProps = {\n  open: boolean;\n  items: Item[];\n};',
    );
    expect(plan.value.signature).toBe('{ open, items }: ItemListProps');
    expect(plan.value.typeImports).toEqual(["import type { Item } from '../pages/List';"]);
    expect(plan.value.exportAt).toEqual([SOURCE.indexOf('type Item')]);
  });

  it('TypeScript: a name whose type cannot be read refuses with its name', async () => {
    const port: PropTypesPort = () => Promise.resolve(ok(['boolean', '']));
    const plan = await planProps(context(true), port);
    expect(plan.ok || plan.error).toEqual({
      code: 'E023',
      params: { reason: 'propType', name: 'items' },
    });
  });
});
