import type { DraftInfo } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { deleteDraft, duplicateDraft, renameDraft } from '../../api/project-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useEditMode } from '../project/use-edit-mode.ts';
import { PromoteDraftDialog } from './promote-draft-dialog.tsx';
import { useDrafts } from './use-drafts.ts';

type DraftRowActionsProps = {
  readonly draft: DraftInfo;
  readonly onStartRename: () => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
  readonly onPromote: () => void;
};

function DraftRowActions({
  draft,
  onStartRename,
  onDuplicate,
  onDelete,
  onPromote,
}: DraftRowActionsProps) {
  const { t } = useTranslation();
  const editMode = useEditMode();
  if (editMode === 'viewOnly') return undefined;
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        data-testid={`draft-rename-${draft.file}`}
        onClick={onStartRename}
        className="h-6 rounded-md border border-line bg-card-solid px-2 hover:bg-field text-xs text-ink-soft hover:text-ink"
      >
        {t('drafts.rename')}
      </button>
      <button
        type="button"
        data-testid={`draft-duplicate-${draft.file}`}
        onClick={onDuplicate}
        className="h-6 rounded-md border border-line bg-card-solid px-2 hover:bg-field text-xs text-ink-soft hover:text-ink"
      >
        {t('drafts.duplicate')}
      </button>
      <button
        type="button"
        data-testid={`draft-promote-${draft.file}`}
        onClick={onPromote}
        className="h-6 rounded-md border border-line bg-card-solid px-2 hover:bg-field text-xs text-ink-soft hover:text-ink"
      >
        {t('drafts.promote')}
      </button>
      <button
        type="button"
        data-testid={`draft-delete-${draft.file}`}
        disabled={draft.inUse}
        onClick={onDelete}
        className="h-6 rounded-md border border-line bg-card-solid px-2 hover:bg-field text-xs text-danger hover:bg-danger/10 disabled:opacity-40"
      >
        {t('drafts.delete')}
      </button>
    </div>
  );
}

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
  const { t } = useTranslation();
  if (isRenaming) {
    return <DraftRenameForm draft={draft} onCancel={onCancelRename} onSave={onSaveRename} />;
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-[7px] border border-line bg-card-solid px-2.5 py-2 text-xs">
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-ink">{draft.name}</span>
          {draft.inUse && (
            <span
              data-testid="draft-in-use"
              className="rounded bg-sun-soft px-1.5 py-0.5 text-[10px] font-semibold text-ink"
            >
              {t('drafts.inUse')}
            </span>
          )}
        </div>
        <span className="truncate font-mono text-[11px] text-ink-faint">{draft.file}</span>
      </div>
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
      if (currentDraftFile === file) closeDraft(projectId);
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
};

export function DraftsContent({
  drafts,
  ignored,
  errorMsg,
  actions,
  onPromote,
}: DraftsContentProps) {
  const { t } = useTranslation();
  const [renamingFile, setRenamingFile] = useState<string>();

  return (
    <div data-testid="drafts-dialog" className="flex flex-col gap-3">
      {ignored && (
        <div
          data-testid="drafts-ignored-warning"
          className="rounded-md bg-sun-soft p-2 text-xs text-ink"
        >
          {t('drafts.ignoredWarning')}
        </div>
      )}
      {errorMsg !== undefined && (
        <div role="alert" className="text-xs text-danger">
          {errorMsg}
        </div>
      )}
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

export function DraftsPanel({
  drafts: propDrafts,
  ignored: propIgnored,
  projectId: propProjectId,
  onReload: propReload,
}: DraftsPanelProps = {}) {
  const storeData = useDrafts();
  const drafts = propDrafts ?? storeData.drafts;
  const ignored = propIgnored ?? storeData.ignored;
  const projectId = propProjectId ?? storeData.projectId;
  const onReload = propReload ?? storeData.reload;

  const { t: tError } = useTranslation('errors');
  const [promotingDraft, setPromotingDraft] = useState<DraftInfo>();
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const actions = useDraftItemActions({ projectId, onReload, setErrorMsg, tError });

  return (
    <div data-testid="drafts-panel" className="flex flex-col gap-3">
      <DraftsContent
        drafts={drafts}
        ignored={ignored}
        errorMsg={errorMsg}
        actions={actions}
        onPromote={setPromotingDraft}
      />
      {promotingDraft !== undefined && (
        <PromoteDraftDialog
          open={true}
          draft={promotingDraft}
          projectId={projectId}
          onClose={() => {
            setPromotingDraft(undefined);
          }}
          onPromoted={() => {
            onReload();
          }}
        />
      )}
    </div>
  );
}
