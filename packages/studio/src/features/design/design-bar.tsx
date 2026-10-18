// Bar indicating currently designed target (SPEC-04 R-CP-11, spec-log #23).
import { useTranslation } from 'react-i18next';

import { useDesignStore } from './design-store.ts';

export function DesignBar() {
  const { t } = useTranslation();
  const target = useDesignStore((s) => s.target);
  const kind = target?.kind ?? 'page';
  const name = target?.name ?? target?.route ?? '';
  const file = target?.file;

  return (
    <div
      data-testid="design-bar"
      className="flex items-center gap-2 border-b border-line bg-card/40 px-4 py-1.5 text-xs text-ink-soft backdrop-blur-sm"
    >
      <span className="font-medium text-ink">{t(`design.kind.${kind}`)}</span>
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
    </div>
  );
}
