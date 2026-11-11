// Bar indicating currently designed target (SPEC-04 R-CP-11, R-CP-15, spec-log #23, #24).
import { useTranslation } from 'react-i18next';

import { useComponentsStore } from '../components-panel/use-project-components.ts';
import { useDesignStore } from './design-store.ts';

function useDesignBarState() {
  const target = useDesignStore((s) => s.target);
  const componentMode = useDesignStore((s) => s.componentMode);
  const components = useComponentsStore((s) => s.components);

  const isComponentMode = componentMode !== undefined;
  const kind = isComponentMode ? 'component' : (target?.kind ?? 'page');
  const name = isComponentMode
    ? componentMode.componentName
    : (target?.name ?? target?.route ?? '');
  const file = isComponentMode ? componentMode.filePath : target?.file;

  const matchedComp = isComponentMode
    ? components.find(
        (c) => c.name === componentMode.componentName || c.file === componentMode.filePath,
      )
    : undefined;
  const usages = matchedComp?.usages ?? 0;

  return { isComponentMode, kind, name, file, usages };
}

/** The file being designed, or a warning when KumiCraft does not know it yet. */
function DesignFile({ file }: { readonly file?: string | undefined }) {
  const { t } = useTranslation();
  if (file === undefined || file === '') {
    return (
      <span className="min-w-0 truncate rounded-md bg-sun-soft px-1.5 py-0.5 text-[11px] text-warn">
        {t('design.unknownFile')}
      </span>
    );
  }
  return (
    <span
      data-testid="design-bar-file"
      title={file}
      className="min-w-0 truncate font-mono text-[11px] text-ink-faint"
    >
      {file}
    </span>
  );
}

export function DesignBar() {
  const { t } = useTranslation();
  const { isComponentMode, kind, name, file, usages } = useDesignBarState();

  return (
    <div
      data-testid="design-bar"
      className="flex min-w-0 items-center gap-1.5 text-xs whitespace-nowrap text-ink-soft"
    >
      <span
        data-testid="design-bar-kind"
        className={`shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${
          kind === 'component' ? 'bg-accent-soft text-ink' : 'bg-accent-soft text-accent'
        }`}
      >
        {t(`design.kind.${kind}`)}
      </span>
      <span data-testid="design-bar-name" className="shrink-0 font-medium text-ink">
        {name}
      </span>
      <DesignFile file={file} />
      {isComponentMode && usages > 1 && (
        <span
          data-testid="design-bar-usages"
          className="shrink-0 rounded-md bg-sun-soft px-1.5 py-0.5 text-[10.5px] font-medium text-warn"
        >
          {t('design.usages', { count: usages })}
        </span>
      )}
      {isComponentMode && (
        <button
          type="button"
          data-testid="design-bar-back"
          onClick={() => {
            useDesignStore.getState().exitComponentMode();
          }}
          className="h-6 shrink-0 rounded-md border border-line px-2 text-xs text-ink hover:bg-field"
        >
          {t('design.back')}
        </button>
      )}
    </div>
  );
}
