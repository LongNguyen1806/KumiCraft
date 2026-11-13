// Library block types (SPEC-04 section 15 M-LB, R-LB-10, R-ST-12).

export type LibraryBlockCategory = 'layout' | 'content' | 'form' | 'data' | 'composite';

export type NeutralBlock = {
  /** JSX like `jsx`, with every styled element carrying `className="@<key>"` in place of Tailwind classes. */
  readonly jsx: { readonly vi: string; readonly en: string };
  /** CSS declarations (longhand or common shorthands) of each key, verbatim CSS values. */
  readonly styles: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Hand-authored Bootstrap 5 classes for each key (component + utility); missing keys fall back to CSS. */
  readonly bootstrap: Readonly<Record<string, string>>;
};

export type LibraryBlockVariant = {
  readonly id: string;
  readonly labelKey: string;
  readonly jsx: { readonly vi: string; readonly en: string };
  readonly neutral: NeutralBlock;
};

export type LibraryBlock = {
  readonly id: string;
  readonly category: LibraryBlockCategory;
  readonly labelKey: string;
  readonly keywords: {
    readonly vi: readonly string[];
    readonly en: readonly string[];
  };
  readonly icon: string;
  readonly jsx: {
    readonly vi: string;
    readonly en: string;
  };
  readonly neutral: NeutralBlock;
  readonly variants?: readonly LibraryBlockVariant[];
};
