// Header of Inspector: scope badge, interaction state, lock banner, and warnings (SPEC-04 M-IN, R-IN-12..16).
import { HTML_SETTABLE_TAGS, type HtmlSettableTag, type InteractionState } from '@kumicraft/shared';
import { ExternalLink, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { editSource } from '../../../api/source-client.ts';
import { errorText } from '../../../routes/error-text.ts';
import { askAiAboutElement } from '../../chat/ask-ai-about-element.ts';
import { useOpenInEditor } from '../../editor/use-open-in-editor.ts';
import { useEditMode } from '../../project/use-edit-mode.ts';
import type { InspectorLockReason, InspectorTarget, InspectorWarning } from '../types.ts';
import { StructureActions } from './structure-actions.tsx';

function isHtmlSettableTag(tag: string): tag is HtmlSettableTag {
  return (HTML_SETTABLE_TAGS as readonly string[]).includes(tag);
}

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

function TagTitleSelect({
  tag,
  missingHref,
  onTagChange,
}: {
  readonly tag: HtmlSettableTag;
  readonly missingHref: boolean;
  readonly onTagChange: (after: HtmlSettableTag) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5">
      <select
        data-testid="inspector-tag-select"
        aria-label={t('inspector.tagSelectLabel')}
        value={tag}
        onChange={(e) => {
          const next = e.target.value;
          if (isHtmlSettableTag(next) && next !== tag) onTagChange(next);
        }}
        className="h-6 rounded border border-line bg-card-solid px-1.5 font-mono text-[12px] font-semibold text-ink-strong hover:bg-field"
      >
        {HTML_SETTABLE_TAGS.map((candidate) => (
          <option key={candidate} value={candidate}>
            &lt;{candidate}&gt;
          </option>
        ))}
      </select>
      {missingHref && (
        <button
          type="button"
          data-testid="link-href-hint"
          onClick={() => {
            const input = document.getElementById('attr-href');
            if (input instanceof HTMLInputElement) input.focus();
          }}
          className="rounded bg-sun-soft px-1.5 py-0.5 text-[10px] font-medium text-ink hover:underline"
        >
          {t('inspector.linkHrefHint')}
        </button>
      )}
    </div>
  );
}

function HeaderActionButtons({ onOpenEditor }: { readonly onOpenEditor: () => void }) {
  const { t } = useTranslation();
  return (
    <>
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
    </>
  );
}

/** The tag (editable when HTML-settable) and its code line, with href hint, Ask AI, and Open in editor. */
function TargetTitleRow({
  tag,
  loc,
  canEditTag,
  missingHref,
  onTagChange,
  onOpenEditor,
}: {
  readonly tag: string;
  readonly loc: string;
  readonly canEditTag: boolean;
  readonly missingHref: boolean;
  readonly onTagChange: (after: HtmlSettableTag) => void;
  readonly onOpenEditor: () => void;
}) {
  return (
    <div className="flex items-start gap-1">
      <div className="min-w-0 flex-1 space-y-0.5">
        {canEditTag && isHtmlSettableTag(tag) ? (
          <TagTitleSelect tag={tag} missingHref={missingHref} onTagChange={onTagChange} />
        ) : (
          <div className="font-mono text-[13px] font-semibold break-all text-ink-strong">
            &lt;{tag}&gt;
          </div>
        )}
        <div className="font-mono text-[11px] break-all text-ink-faint">{loc}</div>
      </div>
      <HeaderActionButtons onOpenEditor={onOpenEditor} />
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

function useHeaderTagChange(target: Extract<InspectorTarget, { readonly kind: 'element' }>) {
  const [changingTag, setChangingTag] = useState(false);
  const handleTagChange = (after: HtmlSettableTag) => {
    const src = target.source;
    if (src === undefined) return;
    setChangingTag(true);
    const run = async () => {
      try {
        await editSource({ edit: { kind: 'setTag', loc: src.loc, tag: src.tag, after } });
        target.refresh();
      } finally {
        setChangingTag(false);
      }
    };
    void run();
  };
  return { changingTag, handleTagChange };
}

export function InspectorHeader({ target }: InspectorHeaderProps) {
  const { t: tError } = useTranslation('errors');
  const editor = useOpenInEditor();
  const editMode = useEditMode();
  const { changingTag, handleTagChange } = useHeaderTagChange(target);
  const tag = target.source?.tag ?? target.ref.loc.split(':')[0] ?? 'element';
  const canEditTag =
    target.source !== undefined &&
    target.source.readonly === undefined &&
    target.lockReason !== 'outsideSource' &&
    editMode !== 'viewOnly' &&
    !changingTag &&
    isHtmlSettableTag(tag);
  const missingHref = tag === 'a' && target.source?.attributes['href'] === undefined;

  return (
    <div className="-mx-3 flex flex-col gap-2 border-b border-line px-3 pb-2.5">
      <TargetTitleRow
        tag={tag}
        loc={target.ref.loc}
        canEditTag={canEditTag}
        missingHref={missingHref}
        onTagChange={handleTagChange}
        onOpenEditor={() => {
          editor.open(target.ref.loc);
        }}
      />
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
