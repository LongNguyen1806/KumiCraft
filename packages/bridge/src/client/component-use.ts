// Which JSX line placed the component an element is the first element of. A component (`<Card>`,
// `<Reveal>`) renders no element of its own: the page shows only the elements of its file. The
// transform gives each component tag a `data-rc-use` prop (its file:line:column); React keeps the
// props of every component it renders (its fiber), so walking up from the element finds them.
// React 17 to 19 keep this record under `__reactFiber$…`; without it (another framework, a future
// React) the answer is `undefined` and the Studio keeps today's behavior.

type FiberLike = {
  readonly type: unknown;
  readonly return: unknown;
  readonly child?: unknown;
  readonly stateNode?: unknown;
  readonly memoizedProps: unknown;
};

function asFiber(value: unknown): FiberLike | undefined {
  if (!(value instanceof Object)) return undefined;
  if (!('return' in value) || !('memoizedProps' in value) || !('type' in value)) return undefined;
  return value;
}

function fiberOf(el: Element): FiberLike | undefined {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  return key === undefined ? undefined : asFiber(Reflect.get(el, key));
}

export type ComponentUse = { readonly loc: string; readonly tag: string };

/** `data-rc-use="src/a.tsx:5:7|Card"` → its place and its tag as written. */
function useOf(fiber: FiberLike): ComponentUse | undefined {
  const props = fiber.memoizedProps;
  if (!(props instanceof Object)) return undefined;
  const use: unknown = Reflect.get(props, 'data-rc-use');
  if (typeof use !== 'string') return undefined;
  const bar = use.lastIndexOf('|');
  if (bar <= 0 || bar === use.length - 1) return undefined;
  return { loc: use.slice(0, bar), tag: use.slice(bar + 1) };
}

/** The first element a component fiber renders (through Fragments and inner components). */
function firstElementOf(fiber: FiberLike): unknown {
  for (let f = asFiber(fiber.child); f !== undefined; f = asFiber(f.child)) {
    if (typeof f.type === 'string') return f.stateNode;
  }
  return undefined;
}

/** Every use whose component starts at `el`, nearest first (`<Card>` inside `<ProductCard>`). */
function usesStartingAt(el: Element): ComponentUse[] {
  const own = fiberOf(el);
  if (own === undefined) return [];
  const uses: ComponentUse[] = [];
  for (let fiber = asFiber(own.return); fiber !== undefined; fiber = asFiber(fiber.return)) {
    // Another element above: `el` is a child inside it, not the first element of a component.
    if (typeof fiber.type === 'string') break;
    const use = useOf(fiber);
    if (use === undefined) continue;
    // Only its first element stands for the component (a Fragment's second child does not).
    if (firstElementOf(fiber) !== el) break;
    uses.push(use);
  }
  return uses;
}

function fileOfUse(use: ComponentUse): string {
  return use.loc.replace(/:\d+:\d+$/, '');
}

/**
 * The `data-rc-use` of the component whose first element `el` is. When several components start
 * at the same element (a `<ProductCard>` whose file returns a `<Card>`), the one written in the
 * file being designed wins: that is the tag the user placed, and the one Delete or Duplicate must
 * act on. Without such a use, the outermost one. `undefined` when `el` is inside a component
 * (another element comes first) or React's record is not there.
 */
export function componentUseOf(el: Element, designFile?: string): ComponentUse | undefined {
  const uses = usesStartingAt(el);
  return uses.find((use) => fileOfUse(use) === designFile) ?? uses.at(-1);
}
