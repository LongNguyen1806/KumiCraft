// Project Components Panel (SPEC-04 R-CP-11..13, spec-log #23).
import { normalizeText } from '@kumicraft/content';
import { type ProjectComponent } from '@kumicraft/shared';
import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { InsertButton } from '../../components/ui/insert-button.tsx';
import { LoadFailed } from '../../components/ui/load-failed.tsx';
import { studioBridgeChannel } from '../../core/bridge-channel.ts';
import { useDndStore } from '../../core/dnd-store.ts';
import { useSelectionStore } from '../../core/selection-store.ts';
import { type ErrorInfo, errorText } from '../../routes/error-text.ts';
import { useDesignStore } from '../design/design-store.ts';
import { SelectInFileHint } from '../design/select-in-file-hint.tsx';
import { insertComponent } from './insert-component.ts';
import { useComponentsStore, useProjectComponents } from './use-project-components.ts';

type ComponentItemProps = {
  readonly component: ProjectComponent;
  readonly isSelf: boolean;
  readonly disabled: boolean;
  readonly onSelect: (component: ProjectComponent) => void;
};

/** Dragged onto the Canvas, or inserted at the selection with its + button (R-CP-13). */
function ComponentItem({ component, isSelf, disabled, onSelect }: ComponentItemProps) {
  const { t } = useTranslation();
  const addTitle = isSelf
    ? t('components.selfInsert')
    : t('components.add', { name: component.name });

  return (
    <div
      data-testid={`component-item-${component.name}`}
      aria-disabled={isSelf}
      title={isSelf ? t('components.selfInsert') : undefined}
      draggable={!isSelf}
      onDragStart={(e) => {
        if (isSelf) return;
        e.dataTransfer.setData('text/plain', component.name);
        e.dataTransfer.effectAllowed = 'copy';
        useDndStore.getState().startDrag({ source: 'component', component });
      }}
      onDragEnd={() => {
        if (useDndStore.getState().drag !== undefined) {
          studioBridgeChannel.dragEnd(false);
          useDndStore.getState().endDrag();
        }
      }}
      className="relative flex w-full cursor-grab flex-col items-start gap-1 rounded-[7px] border border-line bg-card-solid p-2.5 pr-8 text-left transition-colors hover:border-border hover:bg-field active:cursor-grabbing aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
    >
      <div className="flex w-full items-center justify-between gap-1.5">
        <span className="text-xs font-medium text-ink leading-tight">{component.name}</span>
        {component.kind === 'layout' && (
          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
            {t('components.layout')}
          </span>
        )}
      </div>
      <span className="text-[11px] text-ink-faint font-mono truncate max-w-full">
        {component.file}
      </span>
      <span className="text-[11px] text-ink-soft">
        {t('components.usages', { count: component.usages })}
      </span>
      <InsertButton
        testId={`component-add-${component.name}`}
        label={addTitle}
        disabled={disabled || isSelf}
        onInsert={() => {
          onSelect(component);
        }}
      />
    </div>
  );
}

type ComponentSearchHeaderProps = {
  readonly query: string;
  readonly onQueryChange: (q: string) => void;
  readonly errorInfo?: ErrorInfo | undefined;
};

function ComponentSearchHeader({ query, onQueryChange, errorInfo }: ComponentSearchHeaderProps) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');

  return (
    <div className="space-y-2 pb-2">
      <input
        type="search"
        data-testid="component-search"
        placeholder={t('components.search')}
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
        }}
        className="h-7 w-full rounded-md border border-line bg-card-solid px-2.5 text-xs text-ink placeholder:text-ink-faint"
      />

      {errorInfo !== undefined && (
        <p role="alert" className="text-xs text-danger" data-testid="components-error">
          {errorInfo.code === 'design.selectInFile' ? (
            <SelectInFileHint info={errorInfo} />
          ) : (
            errorText(tError, errorInfo.code, errorInfo.params)
          )}
        </p>
      )}
    </div>
  );
}

function useFilteredComponents(
  components: readonly ProjectComponent[],
  query: string,
): readonly ProjectComponent[] {
  return useMemo(() => {
    const norm = normalizeText(query);
    if (!norm) return components;
    return components.filter((c) => normalizeText(c.name).includes(norm));
  }, [components, query]);
}

/** The components, or that the list is still being read, or that there is none. */
/** Still reading, could not read, or no component in the project. */
function ComponentListStatus({
  loaded,
  failed,
}: {
  readonly loaded: boolean;
  readonly failed: boolean;
}) {
  const { t } = useTranslation();
  if (!loaded) {
    return (
      <p
        role="status"
        data-testid="components-loading"
        className="flex items-center justify-center gap-2 py-6 text-xs text-ink-faint"
      >
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        {t('components.loading')}
      </p>
    );
  }
  if (failed) {
    return (
      <LoadFailed
        testId="components-load-failed"
        message={t('components.loadFailed')}
        onRetry={() => {
          useComponentsStore.getState().retry();
        }}
      />
    );
  }
  return <p className="py-6 text-center text-xs text-ink-faint">{t('components.empty')}</p>;
}

function ComponentList({
  loaded,
  failed,
  components,
  designFile,
  disabled,
  onSelect,
}: {
  readonly loaded: boolean;
  readonly failed: boolean;
  readonly components: readonly ProjectComponent[];
  readonly designFile: string | undefined;
  readonly disabled: boolean;
  readonly onSelect: (component: ProjectComponent) => void;
}) {
  return (
    <div className="flex-1 space-y-1.5 overflow-y-auto py-1">
      {!loaded || failed || components.length === 0 ? (
        <ComponentListStatus loaded={loaded} failed={failed} />
      ) : (
        components.map((comp) => (
          <ComponentItem
            key={`${comp.file}#${comp.name}`}
            component={comp}
            isSelf={designFile !== undefined && comp.file === designFile}
            disabled={disabled}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  );
}

export function ComponentsPanel() {
  const { t } = useTranslation();
  const components = useProjectComponents();
  const loaded = useComponentsStore((s) => s.loaded);
  const failed = useComponentsStore((s) => s.failed);
  const designFile = useDesignStore((s) => s.componentMode?.filePath ?? s.target?.file);
  const selectedRefs = useSelectionStore((s) => s.selectedRefs);
  const [query, setQuery] = useState('');
  const [inserting, setInserting] = useState(false);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo>();

  const hasSelection = selectedRefs.length === 1;
  const filtered = useFilteredComponents(components, query);

  const handleSelect = async (component: ProjectComponent) => {
    if (!hasSelection || inserting) return;
    setInserting(true);
    setErrorInfo(undefined);
    const res = await insertComponent(component);
    setInserting(false);
    if (!res.ok && res.error) {
      setErrorInfo(res.error);
    }
  };

  return (
    <aside
      aria-label={t('components.title')}
      data-testid="components-panel"
      className="flex h-full flex-col overflow-hidden text-xs"
    >
      <ComponentSearchHeader query={query} onQueryChange={setQuery} errorInfo={errorInfo} />

      <ComponentList
        loaded={loaded}
        failed={failed}
        components={filtered}
        designFile={designFile}
        disabled={!hasSelection || inserting}
        onSelect={(c) => {
          void handleSelect(c);
        }}
      />
    </aside>
  );
}
