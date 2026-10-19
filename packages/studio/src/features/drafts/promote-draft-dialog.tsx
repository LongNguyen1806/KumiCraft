import { type DraftInfo, pageNames, type StructureResult } from '@reactcraft/shared';
import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { promoteDraft } from '../../api/project-client.ts';
import { Dialog } from '../../components/ui/dialog.tsx';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import {
  PageDirAndFileFields,
  PageNameAndPathFields,
  useDirSuggestions,
} from '../pages/add-page-form.tsx';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';

export type PromoteDraftDialogProps = {
  readonly open: boolean;
  readonly draft: DraftInfo | undefined;
  readonly projectId?: string | undefined;
  readonly onClose: () => void;
  readonly onPromoted?: (res: StructureResult) => void;
};

type TargetSelectProps = {
  readonly target: 'page' | 'component';
  readonly onSelect: (target: 'page' | 'component') => void;
};

function TargetSelect({ target, onSelect }: TargetSelectProps) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-4">
      <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
        <input
          type="radio"
          name="promote-target"
          data-testid="promote-target-page"
          checked={target === 'page'}
          onChange={() => {
            onSelect('page');
          }}
        />
        <span>{t('drafts.promoteAsPage')}</span>
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
        <input
          type="radio"
          name="promote-target"
          data-testid="promote-target-component"
          checked={target === 'component'}
          onChange={() => {
            onSelect('component');
          }}
        />
        <span>{t('drafts.promoteAsComponent')}</span>
      </label>
    </div>
  );
}

function ComponentNameField({
  name,
  disabled,
  onNameChange,
}: {
  readonly name: string;
  readonly disabled?: boolean;
  readonly onNameChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="flex flex-col gap-1 text-ink-soft">
      {t('components.extract.name')}
      <input
        data-testid="page-name"
        type="text"
        disabled={disabled}
        value={name}
        onChange={(e) => {
          onNameChange(e.target.value);
        }}
        placeholder={t('components.extract.namePlaceholder')}
        className="rounded border border-border bg-field px-2 py-1 text-ink disabled:opacity-50"
      />
    </label>
  );
}

type ExecutePromoteParams = {
  readonly draft: DraftInfo;
  readonly target: 'page' | 'component';
  readonly name: string;
  readonly dir: string;
  readonly fileName: string;
  readonly path: string;
  readonly keepDraft: boolean;
  readonly projectId: string | undefined;
  readonly tError: ReturnType<typeof useTranslation<'errors'>>['t'];
  readonly closeDraft: (projectId?: string) => void;
  readonly onPromoted?: ((res: StructureResult) => void) | undefined;
};

async function executePromote({
  draft,
  target,
  name,
  dir,
  fileName,
  path,
  keepDraft,
  projectId,
  tError,
  closeDraft,
  onPromoted,
}: ExecutePromoteParams): Promise<string | undefined> {
  try {
    const res = await promoteDraft({
      file: draft.file,
      as: target,
      name: name.trim(),
      dir: dir.trim() || undefined,
      fileName: fileName.trim() || undefined,
      path: target === 'page' ? path.trim() || undefined : undefined,
      keepDraft,
    });
    if (target === 'page') {
      closeDraft(projectId);
      if (res.pagePath !== undefined) studioBridgeChannel.navigate(res.pagePath);
    }
    onPromoted?.(res);
    return undefined;
  } catch (err) {
    const info = toErrorInfo(err);
    return errorText(tError, info.code, info.params);
  }
}

function usePromoteFormFields(initialName: string) {
  const initialNames = pageNames(initialName, 'ts');
  const [name, setName] = useState(initialName);
  const [path, setPath] = useState(initialNames.path);
  const [dir, setDir] = useState('src/pages');
  const [fileName, setFileName] = useState(initialNames.fileName);
  const [isPathManual, setIsPathManual] = useState(false);
  const [isFileManual, setIsFileManual] = useState(false);

  return {
    name,
    setName,
    path,
    setPath: (val: string) => {
      setIsPathManual(true);
      setPath(val);
    },
    dir,
    setDir,
    fileName,
    setFileName: (val: string) => {
      setIsFileManual(true);
      setFileName(val);
    },
    isPathManual,
    isFileManual,
  };
}

function usePromoteSubmit(
  draft: DraftInfo | undefined,
  projectId: string | undefined,
  onClose: () => void,
  onPromoted?: (res: StructureResult) => void,
) {
  const { t: tError } = useTranslation('errors');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const closeDraft = useCanvasViewStore((s) => s.closeDraft);

  const runSubmit = async (params: {
    readonly target: 'page' | 'component';
    readonly name: string;
    readonly dir: string;
    readonly fileName: string;
    readonly path: string;
    readonly keepDraft: boolean;
  }) => {
    if (draft === undefined || !params.name.trim()) return;
    setBusy(true);
    setErrorMsg(undefined);
    try {
      const err = await executePromote({
        draft,
        ...params,
        projectId,
        tError,
        closeDraft,
        onPromoted,
      });
      if (err !== undefined) setErrorMsg(err);
      else onClose();
    } finally {
      setBusy(false);
    }
  };

  return { busy, errorMsg, runSubmit };
}

function usePromoteDraftState(
  draft: DraftInfo | undefined,
  projectId: string | undefined,
  onClose: () => void,
  onPromoted?: (res: StructureResult) => void,
) {
  const [target, setTarget] = useState<'page' | 'component'>('page');
  const fields = usePromoteFormFields(draft?.name ?? '');
  const [keepDraft, setKeepDraft] = useState(true);
  const { busy, errorMsg, runSubmit } = usePromoteSubmit(draft, projectId, onClose, onPromoted);

  const handleNameChange = (val: string) => {
    fields.setName(val);
    const names = pageNames(val, 'ts');
    if (target === 'page' && !fields.isPathManual) fields.setPath(names.path);
    if (!fields.isFileManual) fields.setFileName(names.fileName);
  };

  return {
    target,
    ...fields,
    keepDraft,
    busy,
    errorMsg,
    handleTargetChange: (newTarget: 'page' | 'component') => {
      setTarget(newTarget);
      fields.setDir(newTarget === 'page' ? 'src/pages' : 'src/components');
    },
    handleNameChange,
    setKeepDraft,
    submit: (e: SyntheticEvent) => {
      e.preventDefault();
      void runSubmit({
        target,
        name: fields.name,
        dir: fields.dir,
        fileName: fields.fileName,
        path: fields.path,
        keepDraft,
      });
    },
  };
}

function PromoteFormFields({
  state,
  dirs,
}: {
  readonly state: ReturnType<typeof usePromoteDraftState>;
  readonly dirs: readonly string[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {state.target === 'page' ? (
        <PageNameAndPathFields
          name={state.name}
          path={state.path}
          disabled={state.busy}
          onNameChange={state.handleNameChange}
          onPathChange={state.setPath}
        />
      ) : (
        <ComponentNameField
          name={state.name}
          disabled={state.busy}
          onNameChange={state.handleNameChange}
        />
      )}
      <PageDirAndFileFields
        dir={state.dir}
        fileName={state.fileName}
        dirs={dirs}
        disabled={state.busy}
        onDirChange={state.setDir}
        onFileChange={state.setFileName}
      />
    </div>
  );
}

function PromoteKeepCheckbox({
  checked,
  onChange,
}: {
  readonly checked: boolean;
  readonly onChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="flex cursor-pointer items-center gap-2 text-ink">
      <input
        type="checkbox"
        data-testid="promote-keep"
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
      />
      <span>{t('drafts.promoteKeep')}</span>
    </label>
  );
}

function PromoteDialogBody({
  state,
  dirs,
  free,
}: {
  readonly state: ReturnType<typeof usePromoteDraftState>;
  readonly dirs: readonly string[];
  readonly free: boolean;
}) {
  const { t } = useTranslation();
  return (
    <form
      onSubmit={(e) => {
        state.submit(e);
      }}
      data-testid="draft-promote-dialog"
      className="flex flex-col gap-4 text-xs"
    >
      <TargetSelect target={state.target} onSelect={state.handleTargetChange} />
      {free && (
        <div
          data-testid="promote-free-warning"
          className="rounded bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400"
        >
          {t('drafts.freeWarning')}
        </div>
      )}
      <PromoteFormFields state={state} dirs={dirs} />
      <PromoteKeepCheckbox checked={state.keepDraft} onChange={state.setKeepDraft} />
      {state.errorMsg !== undefined && (
        <div role="alert" className="text-xs text-danger">
          {state.errorMsg}
        </div>
      )}
      <button
        data-testid="promote-submit"
        type="submit"
        disabled={state.busy || !state.name.trim()}
        className="self-end rounded bg-charcoal px-3 py-1.5 text-xs text-on-charcoal disabled:opacity-50"
      >
        {t('drafts.promote')}
      </button>
    </form>
  );
}

export function PromoteDraftDialog({
  open,
  draft,
  projectId,
  onClose,
  onPromoted,
}: PromoteDraftDialogProps) {
  const { t } = useTranslation();
  const dirs = useDirSuggestions();
  const state = usePromoteDraftState(draft, projectId, onClose, onPromoted);

  if (draft === undefined) return undefined;

  return (
    <Dialog
      open={open}
      title={t('drafts.promote')}
      closeLabel={t('settings.close')}
      onClose={onClose}
    >
      <PromoteDialogBody state={state} dirs={dirs} free={draft.free} />
    </Dialog>
  );
}
