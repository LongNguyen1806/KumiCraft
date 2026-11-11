import type { PageInfo, StructureResult } from '@kumicraft/shared';
import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { renameProjectPage } from '../../api/project-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';

export type RenamePageFormProps = {
  readonly page: PageInfo;
  readonly convention: boolean;
  readonly onCancel: () => void;
  readonly onRenamed: (res: StructureResult) => void;
};

function useRenamePageState(page: PageInfo, onRenamed: (res: StructureResult) => void) {
  const { t: tError } = useTranslation('errors');
  const [newPath, setNewPath] = useState(page.path);
  const [newName, setNewName] = useState(page.component ?? '');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(undefined);
    try {
      const res = await renameProjectPage({
        path: page.path,
        newPath: newPath.trim() !== page.path ? newPath.trim() : undefined,
        newName: newName.trim() !== (page.component ?? '') ? newName.trim() : undefined,
      });
      onRenamed(res);
    } catch (err) {
      const info = toErrorInfo(err);
      setErrorMsg(errorText(tError, info.code, info.params));
    } finally {
      setBusy(false);
    }
  };

  return { newPath, setNewPath, newName, setNewName, busy, errorMsg, handleSubmit };
}

type RenamePageInputsProps = {
  readonly state: ReturnType<typeof useRenamePageState>;
  readonly convention: boolean;
};

function RenamePageInputs({ state, convention }: RenamePageInputsProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="flex flex-col gap-1 text-ink-soft">
        {t('pages.newPath')}
        <input
          data-testid="page-rename-path"
          type="text"
          disabled={!convention || state.busy}
          value={state.newPath}
          onChange={(e) => {
            state.setNewPath(e.target.value);
          }}
          className="h-7 rounded-md border border-line bg-card-solid px-2 text-ink disabled:opacity-50"
        />
      </label>
      <label className="flex flex-col gap-1 text-ink-soft">
        {t('pages.newName')}
        <input
          data-testid="page-rename-name"
          type="text"
          disabled={!convention || state.busy}
          value={state.newName}
          onChange={(e) => {
            state.setNewName(e.target.value);
          }}
          className="h-7 rounded-md border border-line bg-card-solid px-2 text-ink disabled:opacity-50"
        />
      </label>
    </div>
  );
}

export function RenamePageForm({ page, convention, onCancel, onRenamed }: RenamePageFormProps) {
  const { t } = useTranslation();
  const state = useRenamePageState(page, onRenamed);

  return (
    <form
      onSubmit={(e) => {
        void state.handleSubmit(e);
      }}
      className="flex flex-col gap-2 rounded-[7px] border border-line bg-wash-cool p-2 text-xs"
    >
      <RenamePageInputs state={state} convention={convention} />
      {state.errorMsg !== undefined && (
        <div role="alert" className="text-xs text-danger">
          {state.errorMsg}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          data-testid="page-rename-cancel"
          type="button"
          disabled={state.busy}
          onClick={onCancel}
          className="h-7 rounded-md border border-line bg-card-solid px-2.5 hover:bg-field text-xs text-ink-soft hover:text-ink"
        >
          {t('pages.cancel')}
        </button>
        <button
          data-testid="page-rename-submit"
          type="submit"
          disabled={!convention || state.busy}
          className="h-7 rounded-md bg-charcoal px-3 text-xs font-medium text-on-charcoal hover:bg-accent-hover disabled:opacity-50"
        >
          {state.busy ? t('pages.renaming') : t('pages.save')}
        </button>
      </div>
    </form>
  );
}
