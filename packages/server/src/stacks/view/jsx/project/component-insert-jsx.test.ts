// The Library's tag for a component with required props (R-CP-11, K9.5).
import { describe, expect, it } from 'vitest';

import { insertJsxFor } from './component-insert-jsx.ts';

describe('insertJsxFor [WP-4.00, K9.5]', () => {
  it('fills the required props of a same-file props type (the Test UI ProductCard)', () => {
    const code = `type ProductCardProps = {
  readonly name: string;
  readonly price: string;
  readonly image: string;
  readonly description: string;
  readonly badge?: string;
};
export function ProductCard({ name }: ProductCardProps) { return <div>{name}</div>; }
`;
    expect(insertJsxFor(code, 'ProductCard')).toBe(
      '<ProductCard name="Name" price="Price" image="" description="Description" />',
    );
  });

  it('reads an interface, an inline type, numbers, booleans, handlers, lists and literal unions', () => {
    const iface = `export interface StatProps { count: number; open: boolean; onPick: (id: string) => void; tags: string[]; size: 'sm' | 'lg' }
export const Stat = ({ count }: StatProps) => <b>{count}</b>;`;
    expect(insertJsxFor(iface, 'Stat')).toBe(
      '<Stat count={0} open={false} onPick={() => {}} tags={[]} size="sm" />',
    );
    const inline = `export default function Tile({ title }: { title: string; note?: string }) { return <p>{title}</p>; }`;
    expect(insertJsxFor(inline, 'Tile')).toBe('<Tile title="Title" />');
  });

  it('required children go between the tags; an intersection adds both sides', () => {
    const code = `type Base = { title: string };
type PanelProps = Base & { children: React.ReactNode };
export function Panel({ title, children }: PanelProps) { return <section>{title}{children}</section>; }`;
    expect(insertJsxFor(code, 'Panel')).toBe('<Panel title="Title">Panel</Panel>');
  });

  it('no required props, JavaScript, a props type from another file or an unknown type: bare tag', () => {
    expect(
      insertJsxFor('export function A({ x }: { x?: string }) { return <i />; }', 'A'),
    ).toBeUndefined();
    expect(insertJsxFor('export function B({ x }) { return <i>{x}</i>; }', 'B')).toBeUndefined();
    expect(
      insertJsxFor(
        "import type { CProps } from './c';\nexport function C(p: CProps) { return <i />; }",
        'C',
      ),
    ).toBeUndefined();
    expect(
      insertJsxFor('export function D({ user }: { user: User }) { return <i />; }', 'D'),
    ).toBeUndefined();
  });
});
