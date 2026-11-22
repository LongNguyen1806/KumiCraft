// Where the picked element sits with respect to components (thiet-ke-component.md §4.2, §4.3):
// a part written inside a component's own file is shown, not edited, until the component is opened
// (a change there would change every use); a part the page passes into a component is the page's,
// with a line saying which component holds it.
import { type ElementRef, type ElementSource, parseLocString } from '@kumicraft/shared';
import { Component } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useSelectionStore } from '../../../core/selection-store.ts';
import { useDesignStore } from '../../design/design-store.ts';

export type ComponentPart =
  | {
      readonly kind: 'inside';
      readonly name: string;
      readonly file: string;
      readonly usages?: number | undefined;
    }
  | { readonly kind: 'children'; readonly owner: string; readonly ownerRef: ElementRef };

const fileOf = (loc: string) => parseLocString(loc)?.file;
const baseName = (file: string) => (file.split('/').pop() ?? file).replace(/\.[jt]sx?$/, '');

function useDesignFile(): string | undefined {
  return useDesignStore((s) => s.componentMode?.filePath ?? s.target?.file);
}

/** The part the selection is, or undefined for a page element or the use of a component. */
export function useComponentPart(
  ref: ElementRef,
  source: ElementSource,
): ComponentPart | undefined {
  const designFile = useDesignFile();
  const info = useSelectionStore((s) =>
    s.selectionInfo.find((i) => i.ref.loc === ref.loc && i.ref.index === ref.index),
  );
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const file = fileOf(source.loc);
  if (designFile === undefined || file === undefined || info?.use !== undefined) return undefined;
  if (file !== designFile) {
    const name = source.component?.name ?? baseName(file);
    return { kind: 'inside', name, file, usages: source.component?.usages };
  }
  // Inside `<Card>…</Card>` of this file: the elements above, up to this file's own, are the
  // Card's; the one the Canvas names as a use placed in this file is the Card.
  let owner: { readonly tag: string; readonly ref: ElementRef } | undefined;
  for (const a of info?.ancestors ?? []) {
    if (fileOf(a.loc) === file) break;
    const use = treeNodes.find((n) => n.ref.loc === a.loc && n.ref.index === a.index)?.component;
    if (use !== undefined && fileOf(use.loc) === designFile) owner = { tag: use.tag, ref: a };
  }
  if (owner === undefined) return undefined;
  return { kind: 'children', owner: owner.tag, ownerRef: owner.ref };
}

const BUTTON =
  'rounded-md border border-line bg-card-solid px-2 py-1 text-[11px] font-medium text-ink hover:bg-wash-cool';

function InsideNotice({ part }: { readonly part: Extract<ComponentPart, { kind: 'inside' }> }) {
  const { t } = useTranslation();
  const text =
    part.usages !== undefined && part.usages > 0
      ? t('componentProps.partOf', { name: part.name, count: part.usages })
      : t('componentProps.partOfUnknown', { name: part.name });
  return (
    <div
      data-testid="component-part-notice"
      className="-mx-3 flex flex-col gap-2 border-b border-line bg-accent-soft px-3 py-2.5 text-xs text-ink"
    >
      <span>{text}</span>
      <span className="text-[11px] text-ink-soft">{t('componentProps.partLocked')}</span>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          data-testid="component-part-edit"
          className={BUTTON}
          onClick={() => {
            useDesignStore
              .getState()
              .enterComponentMode({ componentName: part.name, filePath: part.file });
          }}
        >
          {t('componentProps.edit')}
        </button>
      </div>
    </div>
  );
}

function ChildrenLine({ part }: { readonly part: Extract<ComponentPart, { kind: 'children' }> }) {
  const { t } = useTranslation();
  return (
    <p data-testid="component-children-line" className="py-1.5 text-[11px] text-ink-soft">
      {t('componentProps.inside')}{' '}
      <button
        type="button"
        className="inline-flex items-center gap-0.5 font-medium text-accent hover:underline"
        title={t('componentProps.selectWhole')}
        onClick={() => {
          useSelectionStore.getState().setSelectedRefs([part.ownerRef]);
        }}
      >
        <Component aria-hidden className="size-3" />
        {part.owner}
      </button>
    </p>
  );
}

/** The Inspector body, shown but not usable for a part of a component's own file. */
export function ComponentPartGate({
  refTarget,
  source,
  children,
}: {
  readonly refTarget: ElementRef;
  readonly source: ElementSource;
  readonly children: ReactNode;
}) {
  const part = useComponentPart(refTarget, source);
  if (part === undefined) return children;
  if (part.kind === 'children') {
    return (
      <>
        <ChildrenLine part={part} />
        {children}
      </>
    );
  }
  return (
    <>
      <InsideNotice part={part} />
      <div inert className="opacity-50" data-testid="component-part-locked">
        {children}
      </div>
    </>
  );
}
