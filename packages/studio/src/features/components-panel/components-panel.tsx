// Project Components Panel (SPEC-04 R-CP-11..13, spec-log #23).
import { normalizeText, type ProjectComponent } from '@reactcraft/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { InsertButton } from '../../components/ui/insert-button.tsx';
import { type ErrorInfo, errorText } from '../../routes/error-text.ts';
import { useDesignStore } from '../design/design-store.ts';
import { SelectInFileHint } from '../design/select-in-file-hint.tsx';
import { useDndStore } from '../dnd/dnd-store.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { insertComponent } from './insert-component.ts';
import { useProjectComponents } from './use-project-components.ts';

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
      className="relative flex w-full cursor-grab flex-col items-start gap-1 rounded-lg border border-border/50 bg-field/50 p-2.5 pr-8 text-left transition-all hover:border-accent hover:bg-accent/5 active:cursor-grabbing aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
    >
      <div className="flex w-full items-center justify-between gap-1.5">
        <span className="text-xs font-medium text-ink leading-tight">{component.name}</span>
        {component.kind === 'layout' && (
          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
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
    <div className="p-3 border-b border-border/40 space-y-2">
      <input
        type="search"
        data-testid="component-search"
        placeholder={t('components.search')}
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
        }}
        className="w-full rounded-md border border-border bg-field px-3 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
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

export function ComponentsPanel() {
  const { t } = useTranslation();
  const components = useProjectComponents();
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
      className="flex h-full flex-col overflow-hidden bg-card-solid/60 text-xs"
    >
      <ComponentSearchHeader query={query} onQueryChange={setQuery} errorInfo={errorInfo} />

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-faint">{t('components.empty')}</p>
        ) : (
          filtered.map((comp) => (
            <ComponentItem
              key={`${comp.file}#${comp.name}`}
              component={comp}
              isSelf={designFile !== undefined && comp.file === designFile}
              disabled={!hasSelection || inserting}
              onSelect={(c) => {
                void handleSelect(c);
              }}
            />
          ))
        )}
      </div>
    </aside>
  );
}
