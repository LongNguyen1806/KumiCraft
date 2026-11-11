// Inspector view for viewOnly projects (SPEC-04, WP-4.00).
import { useTranslation } from 'react-i18next';

import { askAiAboutElement } from '../../chat/ask-ai-about-element.ts';
import { useOpenInEditor } from '../../editor/use-open-in-editor.ts';
import type { InspectorTarget } from '../types.ts';

export type ViewOnlyInspectorProps = {
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
};

export function ViewOnlyInspector({ target }: ViewOnlyInspectorProps) {
  const { t } = useTranslation();
  const { t: tErrors } = useTranslation('errors');
  const editor = useOpenInEditor();
  const tag = target.source?.tag ?? target.ref.loc.split(':')[0] ?? 'element';

  return (
    <div
      data-testid="view-only-inspector-banner"
      className="mt-2.5 flex flex-col gap-2 rounded-md border border-sun bg-sun-soft p-3 text-xs text-ink"
    >
      <div className="flex items-center gap-1.5 min-w-0 font-mono text-xs font-semibold text-ink-strong">
        &lt;{tag}&gt;
        <span className="text-[11px] text-ink-faint font-normal truncate">{target.ref.loc}</span>
      </div>
      <p>{tErrors('E023.reasons.viewOnly')}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="ask-ai-element-btn"
          onClick={() => {
            askAiAboutElement();
          }}
          className="h-7 self-start rounded-md border border-line bg-card-solid px-2.5 text-xs font-medium text-ink hover:bg-field"
        >
          {t('inspector.askAi')}
        </button>
        <button
          type="button"
          data-testid="open-in-editor-btn"
          onClick={() => {
            editor.open(target.ref.loc);
          }}
          className="h-7 self-start rounded-md border border-line bg-card-solid px-2.5 text-xs font-medium text-ink hover:bg-field"
        >
          {t('inspector.openInEditor')}
        </button>
      </div>
    </div>
  );
}
