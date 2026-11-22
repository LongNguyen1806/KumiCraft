// The neutral element tree of a library block (03b section 2): what a block is, without the syntax
// of one view language. Read from the block's static JSX; each language renders it back.

/** An attribute as written in the block's JSX: a string, a literal in braces, or a bare name. */
export type TreeAttrValue =
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'boolean'; readonly value: boolean };

export type TreeAttr = { readonly name: string; readonly value: TreeAttrValue };

export type TreeElement = {
  readonly kind: 'element';
  /** The tag as in JSX: `div`, `svg`, `path`… (a capitalized name is a component, not allowed). */
  readonly tag: string;
  /** Attribute names as in JSX (`className`, `htmlFor`, `strokeWidth`). */
  readonly attrs: readonly TreeAttr[];
  readonly children: readonly TreeNode[];
};

/** Text as the page shows it: JSX whitespace already folded, entities already decoded. */
export type TreeText = { readonly kind: 'text'; readonly value: string };

export type TreeNode = TreeElement | TreeText;

/** Thrown when a block is not static JSX (a component, a loop, an expression). */
export class TreeParseError extends Error {
  readonly at: number;

  constructor(message: string, at: number) {
    super(`${message} at ${String(at)}`);
    this.name = 'TreeParseError';
    this.at = at;
  }
}
