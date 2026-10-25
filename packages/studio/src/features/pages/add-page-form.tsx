import { pageNames, type StructureResult } from '@kumicraft/shared';
import type { TFunction } from 'i18next';
import { type SyntheticEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { addProjectPage } from '../../api/project-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { DirInputWithPicker } from '../files/dir-input-with-picker.tsx';
import { useDirSuggestions } from '../files/use-dir-suggestions.ts';
import { useAddPageIntent } from './add-page-intent.ts';

export { useDirSuggestions };

export type AddPageFormProps = {
  readonly convention: boolean;
  readonly defaultDir?: string | undefined;
  readonly onAdded?: ((res: StructureResult) => void) | undefined;
};

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

function useAddPageSubmit(
  name: string,
  path: string,
  dir: string,
  fileName: string,
  tError: ReturnType<typeof useTranslation<'errors'>>['t'],
  onAdded?: (res: StructureResult) => void,
  onSuccess?: () => void,
) {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErrorMsg(undefined);
    try {
      const err = await executeAddPage({ name, path, dir, fileName }, tError, onAdded);
      if (err !== undefined) setErrorMsg(err);
      else onSuccess?.();
    } finally {
      setBusy(false);
    }
  };

  return { busy, errorMsg, submit };
}

function useInitialAndIntentDir(defaultDir: string) {
  const [dir, setDir] = useState(() => {
    const init = useAddPageIntent.getState().targetDir;
    if (init) {
      useAddPageIntent.getState().setTargetDir(undefined);
      return init;
    }
    return defaultDir;
  });

  useEffect(() => {
    return useAddPageIntent.subscribe((state) => {
      if (state.targetDir) {
        setDir(state.targetDir);
        useAddPageIntent.getState().setTargetDir(undefined);
      }
    });
  }, []);

  return [dir, setDir] as const;
}

function useAddPageState(defaultDir: string, onAdded?: (res: StructureResult) => void) {
  const { t: tError } = useTranslation('errors');
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [dir, setDir] = useInitialAndIntentDir(defaultDir);
  const [fileName, setFileName] = useState('');
  const [isPathManual, setIsPathManual] = useState(false);
  const [isFileManual, setIsFileManual] = useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    const names = pageNames(val, 'ts');
    if (!isPathManual) setPath(names.path);
    if (!isFileManual) setFileName(names.fileName);
  };

  const { busy, errorMsg, submit } = useAddPageSubmit(
    name,
    path,
    dir,
    fileName,
    tError,
    onAdded,
    () => {
      resetAddPageFields(setName, setPath, setFileName, setIsPathManual, setIsFileManual);
    },
  );

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

export type PageNameAndPathFieldsProps = {
  readonly name: string;
  readonly path: string;
  readonly disabled?: boolean;
  readonly onNameChange: (val: string) => void;
  readonly onPathChange: (val: string) => void;
};

export function PageNameAndPathFields({
  name,
  path,
  disabled = false,
  onNameChange,
  onPathChange,
}: PageNameAndPathFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <label className="flex flex-col gap-1 text-ink-soft">
        {t('pages.name')}
        <input
          data-testid="page-name"
          type="text"
          disabled={disabled}
          value={name}
          onChange={(e) => {
            onNameChange(e.target.value);
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
          disabled={disabled}
          value={path}
          onChange={(e) => {
            onPathChange(e.target.value);
          }}
          placeholder="/..."
          className="rounded border border-border bg-field px-2 py-1 text-ink disabled:opacity-50"
        />
      </label>
    </>
  );
}

export type PageDirAndFileFieldsProps = {
  readonly dir: string;
  readonly fileName: string;
  readonly dirs: readonly string[];
  readonly disabled?: boolean;
  readonly dirTestId?: string;
  readonly fileTestId?: string;
  readonly onDirChange: (val: string) => void;
  readonly onFileChange: (val: string) => void;
};

export function PageDirAndFileFields({
  dir,
  fileName,
  disabled = false,
  dirTestId = 'page-dir',
  fileTestId = 'page-file',
  onDirChange,
  onFileChange,
}: PageDirAndFileFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <label className="flex flex-col gap-1 text-ink-soft">
        {t('pages.dir')}
        <DirInputWithPicker
          dataTestId={dirTestId}
          disabled={disabled}
          value={dir}
          onChange={onDirChange}
        />
      </label>
      <label className="flex flex-col gap-1 text-ink-soft">
        {t('pages.file')}
        <input
          data-testid={fileTestId}
          type="text"
          disabled={disabled}
          value={fileName}
          onChange={(e) => {
            onFileChange(e.target.value);
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
        <PageNameAndPathFields
          name={state.name}
          path={state.path}
          disabled={!convention || state.busy}
          onNameChange={state.handleNameChange}
          onPathChange={state.setPath}
        />
        <PageDirAndFileFields
          dir={state.dir}
          fileName={state.fileName}
          dirs={dirs}
          disabled={!convention || state.busy}
          onDirChange={state.setDir}
          onFileChange={state.setFileName}
        />
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
