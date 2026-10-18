// Library block types (SPEC-04 section 15 M-LB, R-LB-10).

export type LibraryBlockCategory = 'layout' | 'content' | 'form' | 'data' | 'composite';

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
};
