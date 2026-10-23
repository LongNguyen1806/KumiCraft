// Banner shown in Inspector when current project styling has no visual editor adapter (Round S1, R-PJ-02).
import type { StylingReport } from '@reactcraft/shared';
import { useTranslation } from 'react-i18next';

import { stylingLabel, systemDisplayName } from '../../project/styling-label.ts';

type InspectorStyleUnsupportedBannerProps = {
  readonly styling?: StylingReport | undefined;
};

export function InspectorStyleUnsupportedBanner({ styling }: InspectorStyleUnsupportedBannerProps) {
  const { t } = useTranslation();
  const primarySys = styling?.primary;
  const systemName = primarySys
    ? systemDisplayName({ id: primarySys }, t)
    : t('styling.css', { defaultValue: 'CSS thường' });

  return (
    <div
      data-testid="inspector-style-unsupported"
      className="rounded-md border border-border bg-field p-2.5 text-xs text-ink-soft space-y-1"
    >
      <div className="flex items-center gap-1.5 font-medium text-ink">
        <span className="rounded bg-card px-1.5 py-0.5 font-mono text-[10px]">
          {stylingLabel(styling, t).shortLabel}
        </span>
      </div>
      <p>
        {t('project.styleUnsupportedInspector', {
          system: systemName,
          defaultValue: `Chỉnh kiểu dáng trực quan chưa hỗ trợ cho ${systemName}. Chọn phần tử rồi nhờ AI ở tab AI.`,
        })}
      </p>
    </div>
  );
}
