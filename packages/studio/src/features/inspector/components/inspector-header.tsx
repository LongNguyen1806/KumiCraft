// Header of Inspector: scope badge, interaction state, lock banner, and warnings (SPEC-04 M-IN, R-IN-12..16).
import type { InteractionState } from '@reactcraft/shared';
import { useTranslation } from 'react-i18next';

import { errorText } from '../../../routes/error-text.ts';
import { useOpenInEditor } from '../../editor/use-open-in-editor.ts';
import type { InspectorLockReason, InspectorTarget, InspectorWarning } from '../types.ts';

type InspectorHeaderProps = {
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
};

function LockBanner({
  reason,
  code,
  onOpenEditor,
}: {
  readonly reason: InspectorLockReason;
  readonly code?: string | undefined;
  readonly onOpenEditor: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="lock-banner"
      className="flex flex-col gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-900 dark:text-amber-200"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium leading-relaxed">{t(`inspector.lockReason.${reason}`)}</span>
        <button
          type="button"
          onClick={onOpenEditor}
          className="shrink-0 text-accent underline hover:opacity-80 text-[11px] font-medium"
        >
          {t('inspector.openInEditor')}
        </button>
      </div>
      {code !== undefined && (
        <pre className="overflow-x-auto rounded bg-black/10 p-1 font-mono text-[11px] text-ink">
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
          className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5 text-[11px] text-blue-900 dark:text-blue-200 leading-snug"
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
      className="h-6 rounded border border-border/60 bg-field px-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
    >
      <option value="none">{t('inspector.stateNone')}</option>
      <option value="hover">{t('inspector.stateHover')}</option>
      <option value="focus">{t('inspector.stateFocus')}</option>
      <option value="disabled">{t('inspector.stateDisabled')}</option>
    </select>
  );
}

function TargetMetaRow({
  tag,
  loc,
  writePrefix,
  interactionState,
  onStateChange,
}: {
  readonly tag: string;
  readonly loc: string;
  readonly writePrefix: string;
  readonly interactionState?: InteractionState | undefined;
  readonly onStateChange: (state: InteractionState | undefined) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-mono text-xs font-semibold text-ink-strong truncate">
          &lt;{tag}&gt;
        </span>
        <span className="text-[11px] text-ink-faint truncate font-mono">{loc}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          data-testid="write-prefix-badge"
          className="rounded bg-accent/10 text-accent font-mono text-[11px] px-1.5 py-0.5 font-medium"
          title={t('inspector.scope')}
        >
          {writePrefix || t('inspector.scopeBase')}
        </span>
        <StateSelect interactionState={interactionState} onStateChange={onStateChange} />
      </div>
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
    <div className="flex flex-col gap-2 pb-3 border-b border-border/40">
      <TargetMetaRow
        tag={tag}
        loc={target.ref.loc}
        writePrefix={target.writePrefix}
        interactionState={target.interactionState}
        onStateChange={target.setInteractionState}
      />
      {target.lockReason !== undefined && (
        <LockBanner
          reason={target.lockReason}
          code={target.lockCode}
          onOpenEditor={handleOpenEditor}
        />
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
