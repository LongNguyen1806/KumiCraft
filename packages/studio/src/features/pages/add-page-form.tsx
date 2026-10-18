import { pageNames, type StructureResult } from '@reactcraft/shared';
import type { TFunction } from 'i18next';
import { type SyntheticEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { addProjectPage, fetchProjectDirs } from '../../api/project-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';

export type AddPageFormProps = {
  readonly convention: boolean;
  readonly defaultDir?: string | undefined;
  readonly onAdded?: ((res: StructureResult) => void) | undefined;
};

function useDirSuggestions(): readonly string[] {
  const [dirs, setDirs] = useState<readonly string[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const list = await fetchProjectDirs();
        if (active) setDirs(list);
      } catch {
        // Ignore directory fetch errors.
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);
  return dirs;
}

type AddPageFormValues = {
  readonly name: string;
  readonly path: string;
  readonly dir: string;
  readonly fileName: string;
};

async function executeAddPage(
  values: AddPageFormValues,
  tError: TFunction<'errors'>,
  onAdded?: (res: StructureResult) => void,
): Promise<string | undefined> {
  try {
    const res = await addProjectPage({
      name: values.name.trim(),
      path: values.path.trim() || undefined,
      dir: values.dir.trim() || undefined,
      fileName: values.fileName.trim() || undefined,
    });
    onAdded?.(res);
    return undefined;
  } catch (err) {
    const info = toErrorInfo(err);
    return errorText(tError, info.code, info.params);
  }
}

function resetAddPageFields(
  setName: (v: string) => void,
  setPath: (v: string) => void,
  setFileName: (v: string) => void,
  setIsPathManual: (v: boolean) => void,
  setIsFileManual: (v: boolean) => void,
) {
  setName('');
  setPath('');
  setFileName('');
  setIsPathManual(false);
  setIsFileManual(false);
}

function useAddPageState(defaultDir: string, onAdded?: (res: StructureResult) => void) {
  const { t: tError } = useTranslation('errors');
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [dir, setDir] = useState(defaultDir);
  const [fileName, setFileName] = useState('');
  const [isPathManual, setIsPathManual] = useState(false);
  const [isFileManual, setIsFileManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();

  const handleNameChange = (val: string) => {
    setName(val);
    const names = pageNames(val, 'ts');
    if (!isPathManual) setPath(names.path);
    if (!isFileManual) setFileName(names.fileName);
  };

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErrorMsg(undefined);
    try {
      const err = await executeAddPage({ name, path, dir, fileName }, tError, onAdded);
      if (err !== undefined) setErrorMsg(err);
      else resetAddPageFields(setName, setPath, setFileName, setIsPathManual, setIsFileManual);
    } finally {
      setBusy(false);
    }
  };

  return {
    name,
    path,
    dir,
    fileName,
    busy,
    errorMsg,
    handleNameChange,
    setPath: (val: string) => {
      setIsPathManual(true);
      setPath(val);
    },
    setDir,
    setFileName: (val: string) => {
      setIsFileManual(true);
      setFileName(val);
    },
    submit,
  };
}

type FieldProps = {
  readonly state: ReturnType<typeof useAddPageState>;
  readonly convention: boolean;
};

function PageNameAndPathFields({ state, convention }: FieldProps) {
  const { t } = useTranslation();
  return (
    <>
      <label className="flex flex-col gap-1 text-ink-soft">
        {t('pages.name')}
        <input
          data-testid="page-name"
          type="text"
          disabled={!convention || state.busy}
          value={state.name}
          onChange={(e) => {
            state.handleNameChange(e.target.value);
          }}
          placeholder={t('pages.namePlaceholder')}
          className="rounded border border-border bg-field px-2 py-1 text-ink disabled:opacity-50"
        />
      </label>
      <label className="flex flex-col gap-1 text-ink-soft">
        {t('pages.path')}
        <input
          data-testid="page-path"
          type="text"
          disabled={!convention || state.busy}
          value={state.path}
          onChange={(e) => {
            state.setPath(e.target.value);
          }}
          placeholder="/..."
          className="rounded border border-border bg-field px-2 py-1 text-ink disabled:opacity-50"
        />
      </label>
    </>
  );
}

function PageDirAndFileFields({
  state,
  convention,
  dirs,
}: FieldProps & { readonly dirs: readonly string[] }) {
  const { t } = useTranslation();
  return (
    <>
      <label className="flex flex-col gap-1 text-ink-soft">
        {t('pages.dir')}
        <input
          data-testid="page-dir"
          list="page-dir-list"
          type="text"
          disabled={!convention || state.busy}
          value={state.dir}
          onChange={(e) => {
            state.setDir(e.target.value);
          }}
          className="rounded border border-border bg-field px-2 py-1 text-ink disabled:opacity-50"
        />
        <datalist id="page-dir-list">
          {dirs.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </label>
      <label className="flex flex-col gap-1 text-ink-soft">
        {t('pages.file')}
        <input
          data-testid="page-file"
          type="text"
          disabled={!convention || state.busy}
          value={state.fileName}
          onChange={(e) => {
            state.setFileName(e.target.value);
          }}
          placeholder={t('pages.filePlaceholder')}
          className="rounded border border-border bg-field px-2 py-1 text-ink disabled:opacity-50"
        />
      </label>
    </>
  );
}

export function AddPageForm({ convention, defaultDir = 'src/pages', onAdded }: AddPageFormProps) {
  const { t } = useTranslation();
  const dirs = useDirSuggestions();
  const state = useAddPageState(defaultDir, onAdded);

  return (
    <form
      onSubmit={(e) => {
        void state.submit(e);
      }}
      className="flex flex-col gap-2.5 rounded border border-border p-3"
    >
      <div className="text-xs font-semibold text-ink">{t('pages.add')}</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <PageNameAndPathFields state={state} convention={convention} />
        <PageDirAndFileFields state={state} convention={convention} dirs={dirs} />
      </div>
      {state.errorMsg !== undefined && (
        <div role="alert" className="text-xs text-rose-600">
          {state.errorMsg}
        </div>
      )}
      <button
        data-testid="page-add"
        type="submit"
        disabled={!convention || state.busy || !state.name.trim()}
        className="self-end rounded bg-charcoal px-3 py-1.5 text-xs text-on-charcoal disabled:opacity-50"
      >
        {state.busy ? t('pages.adding') : t('pages.add')}
      </button>
    </form>
  );
}
