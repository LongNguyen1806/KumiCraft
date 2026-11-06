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
      className="flex flex-col gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-900 dark:text-amber-200"
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
          className="self-start rounded border border-amber-500/40 bg-field px-2.5 py-1 text-xs font-medium text-ink hover:bg-field-hover"
        >
          {t('inspector.askAi')}
        </button>
        <button
          type="button"
          data-testid="open-in-editor-btn"
          onClick={() => {
            editor.open(target.ref.loc);
          }}
          className="self-start rounded border border-amber-500/40 bg-field px-2.5 py-1 text-xs font-medium text-ink hover:bg-field-hover"
        >
          {t('inspector.openInEditor')}
        </button>
      </div>
    </div>
  );
}
