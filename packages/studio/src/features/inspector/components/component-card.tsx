// The card on top of the Inspector when a component use is picked (thiet-ke-component.md §4.1, §5):
// which component, where it is defined or which package it comes from, how many places use it,
// and the two things done with it: edit its definition, or take this use off the page.
import { Component, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useProjectComponents } from '../../components-panel/use-project-components.ts';
import { useDesignStore } from '../../design/design-store.ts';
import { executeRemove } from '../../structure/structure-commands.ts';

type ComponentCardProps = {
  readonly tag: string;
  readonly componentFile?: string | undefined;
  readonly packageName?: string | undefined;
};

const BUTTON =
  'rounded-md border border-line bg-field px-2 py-1 text-[11px] font-medium text-ink hover:bg-wash-cool';

function CardOrigin({ componentFile, packageName }: Omit<ComponentCardProps, 'tag'>) {
  const { t } = useTranslation();
  if (packageName !== undefined) {
    return (
      <>
        <span
          data-testid="component-package"
          className="inline-flex items-center gap-1 self-start rounded bg-sun-soft px-1.5 py-px text-[11px] font-medium text-ink"
        >
          <Package aria-hidden className="size-3" />
          {packageName}
        </span>
        <span className="text-[11px] text-ink-soft">{t('componentProps.fromPackage')}</span>
      </>
    );
  }
  if (componentFile === undefined) return undefined;
  return <span className="truncate font-mono text-[10.5px] text-ink-faint">{componentFile}</span>;
}

function CardActions({ tag, componentFile, packageName }: ComponentCardProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-1.5">
      {packageName === undefined && componentFile !== undefined && (
        <button
          type="button"
          data-testid="component-edit"
          className={BUTTON}
          onClick={() => {
            useDesignStore
              .getState()
              .enterComponentMode({ componentName: tag, filePath: componentFile });
          }}
        >
          {t('componentProps.edit')}
        </button>
      )}
      <button
        type="button"
        data-testid="component-remove"
        className={BUTTON}
        onClick={() => {
          void executeRemove();
        }}
      >
        {t('componentProps.remove')}
      </button>
    </div>
  );
}

export function ComponentCard(props: ComponentCardProps) {
  const { t } = useTranslation();
  const { tag, componentFile } = props;
  // Reads the project's components (as the Components panel does) to count the uses.
  const usages = useProjectComponents().find(
    (c) => c.name === tag && c.file === componentFile,
  )?.usages;
  return (
    <div
      data-testid="component-card"
      className="flex flex-col gap-1.5 rounded-lg border border-line bg-card-solid p-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 text-[13px] font-semibold text-ink">
          <Component aria-hidden className="size-3.5 shrink-0 text-accent" />
          <span className="truncate">{tag}</span>
        </span>
        {usages !== undefined && usages > 0 && (
          <span className="shrink-0 text-[11px] text-accent">
            {t('componentProps.usages', { count: usages })}
          </span>
        )}
      </div>
      <CardOrigin componentFile={componentFile} packageName={props.packageName} />
      <CardActions {...props} />
    </div>
  );
}
