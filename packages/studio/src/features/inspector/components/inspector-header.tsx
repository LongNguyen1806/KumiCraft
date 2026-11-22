// Header of Inspector: scope badge, interaction state, lock banner, and warnings (SPEC-04 M-IN, R-IN-12..16).
import {
  type InspectorPreviewState,
  InspectorPreviewStateSchema,
  InteractionStateSchema,
} from '@kumicraft/shared';
import { ExternalLink, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useSelectionStore } from '../../../core/selection-store.ts';
import { errorText } from '../../../routes/error-text.ts';
import { askAiAboutElement } from '../../chat/ask-ai-about-element.ts';
import { useOpenInEditor } from '../../editor/use-open-in-editor.ts';
import type { InspectorLockReason, InspectorTarget, InspectorWarning } from '../types.ts';
import { canEnableSelectedState, GroupHoverParentPicker } from './inspector-scope-controls.tsx';
import { ScreenSessionBar } from './screen-session-bar.tsx';
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
  previewState,
  tag,
  canSelect,
  onStateChange,
}: {
  readonly previewState?: InspectorPreviewState | undefined;
  readonly tag: string;
  readonly canSelect: boolean;
  readonly onStateChange: (state: InspectorPreviewState | undefined) => void;
}) {
  const { t } = useTranslation();
  const selectedReason = t('inspector.stateSelectedReason');
  return (
    <select
      data-testid="interaction-state-select"
      aria-label={t('inspector.state')}
      value={previewState ?? 'none'}
      onChange={(e) => {
        const parsed = InspectorPreviewStateSchema.safeParse(e.target.value);
        onStateChange(parsed.success ? parsed.data : undefined);
      }}
      className="h-[26px] min-w-0 flex-1 rounded-md border border-line bg-card-solid pl-2 text-xs text-ink hover:bg-field"
    >
      <option value="none">{t('inspector.stateNone')}</option>
      <option value="hover">{t('inspector.stateHover')}</option>
      <option value="active">{t('inspector.stateActive')}</option>
      <option value="focus">{t('inspector.stateFocus')}</option>
      <option value="disabled">{t('inspector.stateDisabled')}</option>
      <option value="selected" disabled={!canSelect} title={canSelect ? undefined : selectedReason}>
        {canSelect
          ? t('inspector.stateSelected')
          : `${t('inspector.stateSelected')} (${t('inspector.stateSelectedDisabledHint')})`}
      </option>
      <option value="groupHover">{t('inspector.stateGroupHover')}</option>
      {tag === 'LoadingButton' && <option value="loading">{t('inspector.stateLoading')}</option>}
    </select>
  );
}

const HEADER_ICON =
  'grid size-7 shrink-0 place-items-center rounded-md text-ink-soft transition-colors hover:bg-field hover:text-ink';

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

/** The tag name and its code line, with Ask AI and Open in editor (the tag is switched in Attributes). */
function TargetTitleRow({
  tag,
  loc,
  onOpenEditor,
}: {
  readonly tag: string;
  readonly loc: string;
  readonly onOpenEditor: () => void;
}) {
  return (
    <div className="flex items-start gap-1">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="font-mono text-[13px] font-semibold break-all text-ink-strong">
          &lt;{tag}&gt;
        </div>
        <div className="font-mono text-[11px] break-all text-ink-faint">{loc}</div>
      </div>
      <HeaderActionButtons onOpenEditor={onOpenEditor} />
    </div>
  );
}

/** The state switch of the scope row. */
function useScopeControls(target: Extract<InspectorTarget, { readonly kind: 'element' }>) {
  const previewState = target.previewState ?? target.interactionState;
  const handleStateChange = (next: InspectorPreviewState | undefined) => {
    if (target.setPreviewState !== undefined) {
      target.setPreviewState(next);
      return;
    }
    const parsed = InteractionStateSchema.safeParse(next);
    target.setInteractionState(parsed.success ? parsed.data : undefined);
  };
  return { previewState, handleStateChange };
}

/** Where a change is written: every screen or only the active one, and the chosen state. */
function ScopeRow({
  target,
  tag,
  canSelect,
}: {
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
  readonly tag: string;
  readonly canSelect: boolean;
}) {
  const { t } = useTranslation();
  const { previewState, handleStateChange } = useScopeControls(target);

  return (
    <div className="flex flex-col gap-1.5">
      <ScreenSessionBar
        loc={target.ref.loc}
        stateActive={target.currentScope.state !== undefined || target.currentScope.dark === true}
      />
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-[11px] text-ink-faint">{t('inspector.state')}</span>
        <StateSelect
          previewState={previewState}
          tag={tag}
          canSelect={canSelect}
          onStateChange={handleStateChange}
        />
      </div>
      {previewState === 'groupHover' && (
        <GroupHoverParentPicker
          target={target}
          onGroupChange={(ref) => {
            target.setGroupRef?.(ref);
          }}
        />
      )}
    </div>
  );
}

export function InspectorHeader({ target }: InspectorHeaderProps) {
  const { t: tError } = useTranslation('errors');
  const editor = useOpenInEditor();
  const selectionInfo = useSelectionStore((s) => s.selectionInfo);
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const tag = target.source?.tag ?? target.ref.loc.split(':')[0] ?? 'element';
  const canSelect = canEnableSelectedState(target.source, target.ref, selectionInfo, treeNodes);

  return (
    <div className="-mx-3 flex flex-col gap-2 border-b border-line px-3 pb-2.5">
      <TargetTitleRow
        tag={tag}
        loc={target.ref.loc}
        onOpenEditor={() => {
          editor.open(target.ref.loc);
        }}
      />
      <ScopeRow target={target} tag={tag} canSelect={canSelect} />
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
