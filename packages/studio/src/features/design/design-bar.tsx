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

export function DesignBar() {
  const { t } = useTranslation();
  const { isComponentMode, kind, name, file, usages } = useDesignBarState();

  return (
    <div
      data-testid="design-bar"
      className="flex items-center gap-2 border-b border-line bg-card/40 px-4 py-1.5 text-xs text-ink-soft backdrop-blur-sm"
    >
      <span data-testid="design-bar-kind" className="font-medium text-ink">
        {t(`design.kind.${kind}`)}
      </span>
      <span>·</span>
      <span data-testid="design-bar-name" className="font-medium text-ink">
        {name}
      </span>
      <span>·</span>
      {file ? (
        <span data-testid="design-bar-file" className="font-mono text-[11px] text-ink-soft">
          {file}
        </span>
      ) : (
        <span className="text-[11px] text-amber-600 dark:text-amber-400">
          {t('design.unknownFile')}
        </span>
      )}
      {isComponentMode && usages > 1 && (
        <span
          data-testid="design-bar-usages"
          className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
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
          className="ml-auto rounded border border-border px-2 py-0.5 text-xs text-ink hover:bg-border/20"
        >
          {t('design.back')}
        </button>
      )}
    </div>
  );
}
