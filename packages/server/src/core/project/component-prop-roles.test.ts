// What each prop does, read from the component's own code (thiet-ke-component.md §3), and which
// props the Inspector shows (§3, §5): the author's knobs only, never React's HTML attributes.
import type { ComponentPropSpec } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import { parseJsxAst } from '../source-editor/ast-helpers.ts';
import { type PropUse, readPropDefinition } from './component-prop-roles.ts';
import { shapeComponentProps } from './component-props-shape.ts';

const roles = (code: string, name: string) => {
  const def = readPropDefinition(parseJsxAst(code), name);
  return Object.fromEntries(
    [...(def ?? new Map<string, PropUse>())].map(([k, v]) => [k, v.used ? v.role : '-']),
  );
};

describe('readPropDefinition', () => {
  it('reads what each prop of a card does on screen [R-IN-11]', () => {
    const code = `
      const styles = { flat: 'a', raised: 'b' };
      export function ProductCard({ name, price, image, href, showSale = true, variant = 'flat', sku }) {
        return (
          <a href={href} className={styles[variant]}>
            <img src={image} alt={name} />
            <h3>{name}</h3>
            <Card title={price} />
            {showSale && <span>Giảm giá</span>}
          </a>
        );
      }`;
    expect(roles(code, 'ProductCard')).toEqual({
      name: 'content',
      price: 'content',
      image: 'image',
      href: 'link',
      showSale: 'toggle',
      variant: 'style',
      sku: '-',
    });
    const def = readPropDefinition(parseJsxAst(code), 'ProductCard');
    expect(def?.get('showSale')?.defaultValue).toBe(true);
    expect(def?.get('variant')?.defaultValue).toBe('flat');
  });

  it('follows `props.x`, timers, memo and the default export [R-IN-11]', () => {
    const code = `
      import { memo } from 'react';
      function NotFound(props) {
        useEffect(() => { setTimeout(go, props.redirectAfter * 1000); }, []);
        return <main className={props.featured ? 'ring' : ''}>{props.title}</main>;
      }
      export default memo(NotFound);`;
    expect(roles(code, 'default')).toEqual({
      redirectAfter: 'behavior',
      featured: 'style',
      title: 'content',
    });
  });

  it('leaves out what goes on through `...rest`, and finds nothing for an unknown name [R-IN-11]', () => {
    const code = `export const ImageBox = ({ ratio, ...rest }) => <img className={ratio} {...rest} />;`;
    expect(roles(code, 'ImageBox')).toEqual({ ratio: 'style' });
    expect(readPropDefinition(parseJsxAst(code), 'Missing')).toBe(undefined);
  });
});

const spec = (name: string, extra: Partial<ComponentPropSpec> = {}) => ({
  name,
  kind: 'string' as const,
  required: false,
  hasValue: false,
  readonlyExpression: false,
  ...extra,
});

describe('shapeComponentProps', () => {
  it('shows a package component its own knobs, not the HTML attributes React adds [R-IN-11]', () => {
    const shown = shapeComponentProps(
      [
        {
          ...spec('variant', { kind: 'union', options: ['text', 'contained'] }),
          origin: 'package',
        },
        { ...spec('disabled', { kind: 'boolean' }), origin: 'package' },
        { ...spec('crossOrigin'), origin: 'react' },
        { ...spec('onClick', { kind: 'complex' }), origin: 'react' },
        { ...spec('title', { hasValue: true, value: 'x' }), origin: 'react' },
      ],
      { packageName: '@mui/material' },
    );
    expect(shown.map((p) => [p.name, p.role])).toEqual([
      ['variant', 'style'],
      ['disabled', 'state'],
      ['title', 'content'],
    ]);
  });

  it('shows a project component the knobs its definition reads, typed or not [R-IN-11]', () => {
    const definition = readPropDefinition(
      parseJsxAst(
        'export function A({ title, wide = false, unused }) { return <h1 className={wide ? "w" : ""}>{title}</h1>; }',
      ),
      'A',
    );
    const shown = shapeComponentProps([{ ...spec('unused'), origin: 'project' }], {
      componentFile: 'src/A.jsx',
      definition,
    });
    expect(shown).toEqual([
      expect.objectContaining({ name: 'title', kind: 'string', role: 'content' }),
      expect.objectContaining({
        name: 'wide',
        kind: 'boolean',
        role: 'style',
        defaultValue: false,
      }),
    ]);
  });

  it('marks a prop the page sets but the component never shows (owner, 2026-11-18) [R-IN-11]', () => {
    const definition = readPropDefinition(
      parseJsxAst('export function ProductCard({ name, image }) { return <h3>{name}</h3>; }'),
      'ProductCard',
    );
    const shown = shapeComponentProps(
      [
        { ...spec('name'), hasValue: true, value: 'Lamp', origin: 'project' },
        { ...spec('image'), hasValue: true, value: '/images/a.jpg', origin: 'project' },
      ],
      { componentFile: 'src/ProductCard.tsx', definition },
    );
    expect(shown.find((p) => p.name === 'image')).toMatchObject({ unused: true });
    expect(shown.find((p) => p.name === 'name')).not.toHaveProperty('unused');
  });
});
