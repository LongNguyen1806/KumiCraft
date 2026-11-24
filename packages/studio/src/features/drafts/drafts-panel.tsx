import type { DraftInfo } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { deleteDraft, duplicateDraft, renameDraft } from '../../api/project-client.ts';
import { useCanvasViewStore } from '../../core/canvas-view-store.ts';
import { useProjectInfo } from '../../core/project-store.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { DraftRowActions } from './draft-row-actions.tsx';
import { DraftsDialogs } from './drafts-dialogs.tsx';
import { DraftsNotices, DraftsStatus } from './drafts-empty.tsx';
import { useDraftsRevision } from './drafts-revision.ts';
import { useDrafts } from './use-drafts.ts';

function DraftRenameForm({
  draft,
  onCancel,
  onSave,
}: {
  readonly draft: DraftInfo;
  readonly onCancel: () => void;
  readonly onSave: (newName: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [val, setVal] = useState(draft.name);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (val.trim()) void onSave(val.trim());
      }}
      className="flex flex-1 items-center gap-2"
    >
      <input
        type="text"
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
        }}
        className="flex-1 h-7 rounded-md border border-line bg-card-solid px-2 text-xs text-ink"
      />
      <button
        type="submit"
        disabled={!val.trim()}
        className="h-6 rounded-md bg-charcoal px-2.5 text-xs font-medium text-on-charcoal hover:bg-accent-hover disabled:opacity-50"
      >
        {t('settings.saved', 'Lưu')}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-6 rounded-md border border-line bg-card-solid px-2 hover:bg-field text-xs text-ink-soft"
      >
        {t('components.extract.cancel')}
      </button>
    </form>
  );
}

/** The draft's name and file; a click opens it on the Canvas. */
function DraftOpenButton({
  draft,
  isOpen,
}: {
  readonly draft: DraftInfo;
  readonly isOpen: boolean;
}) {
  const { t } = useTranslation();
  const openDraft = useCanvasViewStore((st) => st.openDraft);
  const projectId = useCanvasViewStore((st) => st.currentProjectId);
  return (
    <button
      type="button"
      data-testid={`draft-open-${draft.file}`}
      aria-current={isOpen ? 'true' : undefined}
      title={t('drafts.openOnCanvas')}
      onClick={() => {
        openDraft(draft.file, projectId);
      }}
      className="flex min-w-0 flex-1 flex-col rounded-md px-1.5 py-1 text-left hover:bg-field"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium text-ink">{draft.name}</span>
        {draft.inUse && (
          <span
            data-testid="draft-in-use"
            className="rounded bg-sun-soft px-1.5 py-0.5 text-[10px] font-semibold text-ink"
          >
            {t('drafts.inUse')}
          </span>
        )}
      </span>
      <span className="truncate font-mono text-[11px] text-ink-faint">{draft.file}</span>
    </button>
  );
}

function DraftRow({
  draft,
  isRenaming,
  onStartRename,
  onCancelRename,
  onSaveRename,
  onDuplicate,
  onDelete,
  onPromote,
}: {
  readonly draft: DraftInfo;
  readonly isRenaming: boolean;
  readonly onStartRename: () => void;
  readonly onCancelRename: () => void;
  readonly onSaveRename: (name: string) => Promise<void>;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
  readonly onPromote: () => void;
}) {
  const isOpen = useCanvasViewStore((st) => st.draftFile === draft.file);
  if (isRenaming) {
    return <DraftRenameForm draft={draft} onCancel={onCancelRename} onSave={onSaveRename} />;
  }
  return (
    <div
      className={`flex items-center gap-1 rounded-[7px] border bg-card-solid py-1 pr-1 pl-1 text-xs ${
        isOpen ? 'border-accent' : 'border-line'
      }`}
    >
      <DraftOpenButton draft={draft} isOpen={isOpen} />
      <DraftRowActions
        draft={draft}
        onStartRename={onStartRename}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onPromote={onPromote}
      />
    </div>
  );
}

type DraftActionsHookParams = {
  readonly projectId: string | undefined;
  readonly onReload?: (() => void) | undefined;
  readonly setErrorMsg: (msg: string | undefined) => void;
  readonly tError: ReturnType<typeof useTranslation<'errors'>>['t'];
};

export function useDraftItemActions({
  projectId,
  onReload,
  setErrorMsg,
  tError,
}: DraftActionsHookParams) {
  const currentDraftFile = useCanvasViewStore((s) => s.draftFile);
  const openDraft = useCanvasViewStore((s) => s.openDraft);
  const closeDraft = useCanvasViewStore((s) => s.closeDraft);

  const handleDuplicate = async (file: string) => {
    try {
      await duplicateDraft({ file });
      onReload?.();
    } catch (err) {
      const info = toErrorInfo(err);
      setErrorMsg(errorText(tError, info.code, info.params));
    }
  };

  const handleDelete = async (file: string) => {
    try {
      await deleteDraft({ file });
      // Closed in every frame that shows it.
      closeDraft(projectId, file);
      useDraftsRevision.getState().bump();
      onReload?.();
    } catch (err) {
      const info = toErrorInfo(err);
      setErrorMsg(errorText(tError, info.code, info.params));
    }
  };

  const handleRename = async (file: string, newName: string) => {
    try {
      const res = await renameDraft({ file, newName });
      if (currentDraftFile === file && res.draftFile !== undefined) {
        openDraft(res.draftFile, projectId);
      }
      onReload?.();
    } catch (err) {
      const info = toErrorInfo(err);
      setErrorMsg(errorText(tError, info.code, info.params));
    }
  };

  return { handleDuplicate, handleDelete, handleRename };
}

type DraftsListProps = {
  readonly drafts: readonly DraftInfo[];
  readonly renamingFile: string | undefined;
  readonly onStartRename: (file: string) => void;
  readonly onCancelRename: () => void;
  readonly onSaveRename: (file: string, newName: string) => Promise<void>;
  readonly onDuplicate: (file: string) => void;
  readonly onDelete: (file: string) => void;
  readonly onPromote: (draft: DraftInfo) => void;
};

export function DraftsList({
  drafts,
  renamingFile,
  onStartRename,
  onCancelRename,
  onSaveRename,
  onDuplicate,
  onDelete,
  onPromote,
}: DraftsListProps) {
  return (
    <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
      {drafts.map((d) => (
        <DraftRow
          key={d.file}
          draft={d}
          isRenaming={renamingFile === d.file}
          onStartRename={() => {
            onStartRename(d.file);
          }}
          onCancelRename={onCancelRename}
          onSaveRename={async (newName) => {
            await onSaveRename(d.file, newName);
          }}
          onDuplicate={() => {
            onDuplicate(d.file);
          }}
          onDelete={() => {
            onDelete(d.file);
          }}
          onPromote={() => {
            onPromote(d);
          }}
        />
      ))}
    </div>
  );
}

export type DraftsContentProps = {
  readonly drafts: readonly DraftInfo[];
  readonly ignored: boolean;
  readonly errorMsg: string | undefined;
  readonly actions: ReturnType<typeof useDraftItemActions>;
  readonly onPromote: (d: DraftInfo) => void;
  readonly loaded?: boolean | undefined;
  readonly failed?: boolean | undefined;
  readonly onRetry?: (() => void) | undefined;
  /** Opens the New draft dialog; without it the panel offers no create button. */
  readonly onNew?: (() => void) | undefined;
};

export function DraftsContent({
  drafts,
  ignored,
  errorMsg,
  actions,
  onPromote,
  loaded = true,
  failed = false,
  onNew,
  onRetry,
}: DraftsContentProps) {
  const [renamingFile, setRenamingFile] = useState<string>();

  return (
    <div data-testid="drafts-dialog" className="flex flex-col gap-3">
      <DraftsNotices ignored={ignored} errorMsg={errorMsg} />
      <DraftsStatus
        loaded={loaded}
        failed={failed}
        count={drafts.length}
        onNew={onNew}
        onRetry={onRetry}
      />
      <DraftsList
        drafts={drafts}
        renamingFile={renamingFile}
        onStartRename={setRenamingFile}
        onCancelRename={() => {
          setRenamingFile(undefined);
        }}
        onSaveRename={async (file, newName) => {
          await actions.handleRename(file, newName);
          setRenamingFile(undefined);
        }}
        onDuplicate={(file) => {
          void actions.handleDuplicate(file);
        }}
        onDelete={(file) => {
          void actions.handleDelete(file);
        }}
        onPromote={onPromote}
      />
    </div>
  );
}

export type DraftsPanelProps = {
  readonly drafts?: readonly DraftInfo[] | undefined;
  readonly ignored?: boolean | undefined;
  readonly projectId?: string | undefined;
  readonly onReload?: (() => void) | undefined;
};

function DraftsUnavailableNotice({ framework }: { readonly framework: string | undefined }) {
  const { t } = useTranslation();
  const aspnet = framework === 'aspnet-razor-pages' || framework === 'aspnet-mvc';
  const messageKey = aspnet
    ? 'drafts.unavailableRazor'
    : framework === 'express-pug'
      ? 'drafts.unavailableExpress'
      : 'drafts.unavailableNext';
  return (
    <div data-testid="drafts-panel" className="flex flex-col gap-3">
      <div
        data-testid="drafts-unavailable"
        className="rounded-lg border border-line bg-field/60 p-3 text-xs text-ink-soft"
      >
        {t(messageKey)}
      </div>
    </div>
  );
}

export function DraftsPanel({
  drafts: propDrafts,
  ignored: propIgnored,
  projectId: propProjectId,
  onReload: propReload,
}: DraftsPanelProps = {}) {
  const project = useProjectInfo();
  const storeData = useDrafts();
  const drafts = propDrafts ?? storeData.drafts;
  const ignored = propIgnored ?? storeData.ignored;
  const projectId = propProjectId ?? storeData.projectId;
  const onReload = propReload ?? storeData.reload;
  const loaded = propDrafts !== undefined || storeData.loaded;
  const [newOpen, setNewOpen] = useState(false);

  const { t: tError } = useTranslation('errors');
  const [promotingDraft, setPromotingDraft] = useState<DraftInfo>();
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const actions = useDraftItemActions({ projectId, onReload, setErrorMsg, tError });

  if (propDrafts === undefined && !storeData.supported) {
    return <DraftsUnavailableNotice framework={project?.support.framework} />;
  }
  return (
    <div data-testid="drafts-panel" className="flex flex-col gap-3">
      <DraftsContent
        drafts={drafts}
        ignored={ignored}
        errorMsg={errorMsg}
        actions={actions}
        onPromote={setPromotingDraft}
        loaded={loaded}
        failed={propDrafts === undefined && storeData.failed}
        onRetry={onReload}
        onNew={() => {
          setNewOpen(true);
        }}
      />
      <DraftsDialogs
        newOpen={newOpen}
        promoting={promotingDraft}
        projectId={projectId}
        onReload={onReload}
        onCloseNew={() => {
          setNewOpen(false);
        }}
        onClosePromote={() => {
          setPromotingDraft(undefined);
        }}
      />
    </div>
  );
}
