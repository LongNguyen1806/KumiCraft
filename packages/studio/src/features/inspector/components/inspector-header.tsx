// Header of Inspector: scope badge, interaction state, lock banner, and warnings (SPEC-04 M-IN, R-IN-12..16).
import type { InteractionState } from '@kumicraft/shared';
import { ExternalLink, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { errorText } from '../../../routes/error-text.ts';
import { askAiAboutElement } from '../../chat/ask-ai-about-element.ts';
import { useOpenInEditor } from '../../editor/use-open-in-editor.ts';
import type { InspectorLockReason, InspectorTarget, InspectorWarning } from '../types.ts';
import { StructureActions } from './structure-actions.tsx';

type InspectorHeaderProps = {
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
};

function LockBanner({
  reason,
  code,
}: {
  readonly reason: InspectorLockReason;
  readonly code?: string | undefined;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="lock-banner"
      className="flex flex-col gap-1.5 rounded-md border border-sun bg-sun-soft p-2.5 text-xs text-ink"
    >
      <span className="leading-relaxed font-medium">{t(`inspector.lockReason.${reason}`)}</span>
      {code !== undefined && (
        <pre className="overflow-x-auto rounded bg-card-solid/70 p-1.5 font-mono text-[11px] text-ink">
          {code}
        </pre>
      )}
    </div>
  );
}

function WarningsList({ warnings }: { readonly warnings: readonly InspectorWarning[] }) {
  const { t } = useTranslation();
  if (warnings.length === 0) return undefined;
  return (
    <>
      {warnings.map((w, idx) => (
        <div
          key={`${w.kind}-${String(idx)}`}
          data-testid={`warning-${w.kind}`}
          className="rounded-md bg-accent-soft px-2.5 py-1.5 text-[11px] leading-snug text-ink"
        >
          {w.kind === 'usages'
            ? t('inspector.warning.usages', { name: w.name ?? 'Component', count: w.count })
            : t('inspector.warning.loop', { count: w.count })}
        </div>
      ))}
    </>
  );
}

function StateSelect({
  interactionState,
  onStateChange,
}: {
  readonly interactionState?: InteractionState | undefined;
  readonly onStateChange: (state: InteractionState | undefined) => void;
}) {
  const { t } = useTranslation();
  return (
    <select
      data-testid="interaction-state-select"
      aria-label={t('inspector.state')}
      value={interactionState ?? 'none'}
      onChange={(e) => {
        const val = e.target.value;
        onStateChange(val === 'none' ? undefined : (val as InteractionState));
      }}
      className="h-[26px] min-w-0 flex-1 rounded-md border border-line bg-card-solid pl-2 text-xs text-ink hover:bg-field"
    >
      <option value="none">{t('inspector.stateNone')}</option>
      <option value="hover">{t('inspector.stateHover')}</option>
      <option value="focus">{t('inspector.stateFocus')}</option>
      <option value="disabled">{t('inspector.stateDisabled')}</option>
    </select>
  );
}

const HEADER_ICON =
  'grid size-7 shrink-0 place-items-center rounded-md text-ink-soft transition-colors hover:bg-field hover:text-ink';

/** The tag and its code line in full, with Ask AI and Open in editor beside them. */
function TargetTitleRow({
  tag,
  loc,
  onOpenEditor,
}: {
  readonly tag: string;
  readonly loc: string;
  readonly onOpenEditor: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-1">
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[13px] font-semibold break-all text-ink-strong">
          &lt;{tag}&gt;
        </div>
        <div className="font-mono text-[11px] break-all text-ink-faint">{loc}</div>
      </div>
      <button
        type="button"
        data-testid="ask-ai-element-btn"
        aria-label={t('inspector.askAi')}
        title={t('inspector.askAi')}
        onClick={() => {
          askAiAboutElement();
        }}
        className={HEADER_ICON}
      >
        <Sparkles className="size-[15px]" aria-hidden />
      </button>
      <button
        type="button"
        data-testid="inspector-open-editor"
        aria-label={t('inspector.openInEditor')}
        title={t('inspector.openInEditor')}
        onClick={onOpenEditor}
        className={HEADER_ICON}
      >
        <ExternalLink className="size-[15px]" aria-hidden />
      </button>
    </div>
  );
}

/** Where a change is written: the breakpoint of the active frame and the chosen state. */
function ScopeRow({
  writePrefix,
  interactionState,
  onStateChange,
}: {
  readonly writePrefix: string;
  readonly interactionState?: InteractionState | undefined;
  readonly onStateChange: (state: InteractionState | undefined) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[11px] text-ink-faint">{t('inspector.scope')}</span>
      <span
        data-testid="write-prefix-badge"
        className="shrink-0 rounded-md bg-accent-soft px-2 py-[3px] font-mono text-[11px] font-medium text-accent"
        title={t('inspector.scope')}
      >
        {writePrefix || t('inspector.scopeBase')}
      </span>
      <StateSelect interactionState={interactionState} onStateChange={onStateChange} />
    </div>
  );
}

export function InspectorHeader({ target }: InspectorHeaderProps) {
  const { t: tError } = useTranslation('errors');
  const editor = useOpenInEditor();
  const handleOpenEditor = () => {
    editor.open(target.ref.loc);
  };

  const tag = target.source?.tag ?? target.ref.loc.split(':')[0] ?? 'element';

  return (
    <div className="-mx-3 flex flex-col gap-2 border-b border-line px-3 pb-2.5">
      <TargetTitleRow tag={tag} loc={target.ref.loc} onOpenEditor={handleOpenEditor} />
      <ScopeRow
        writePrefix={target.writePrefix}
        interactionState={target.interactionState}
        onStateChange={target.setInteractionState}
      />
      <StructureActions target={target} />
      {target.lockReason !== undefined && (
        <LockBanner reason={target.lockReason} code={target.lockCode} />
      )}
      {editor.errorInfo !== undefined && (
        <p role="alert" className="text-xs text-danger" data-testid="open-editor-error">
          {errorText(tError, editor.errorInfo.code, editor.errorInfo.params)}
        </p>
      )}
      <WarningsList warnings={target.warnings} />
    </div>
  );
}
