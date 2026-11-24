// Extract component modal dialog (SPEC-04 R-CP-14, spec-log #24).
import { pageNames, type StructureResult, toComponentName } from '@kumicraft/shared';
import type { TFunction } from 'i18next';
import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { extractComponent } from '../../api/project-client.ts';
import { Dialog } from '../../components/ui/dialog.tsx';
import { useProjectInfo } from '../../core/project-store.ts';
import { useSelectionStore } from '../../core/selection-store.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { DirInputWithPicker } from '../files/dir-input-with-picker.tsx';
import type { InspectorTarget } from '../inspector/types.ts';
import { useComponentsStore } from './use-project-components.ts';

export type ExtractDialogProps = {
  readonly open: boolean;
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
  readonly onClose: () => void;
  readonly onExtracted?: ((res: StructureResult) => void) | undefined;
};

function normalizeFilePath(dir: string, fileName: string): string {
  const cleanDir = dir.trim().replace(/^[/\\]+|[/\\]+$/g, '');
  const cleanFile = fileName.trim().replace(/^[/\\]+/, '');
  return cleanDir ? `${cleanDir}/${cleanFile}` : cleanFile;
}

type FormValidation = {
  readonly isNameValid: boolean;
  readonly isNameDuplicate: boolean;
  readonly isFileDuplicate: boolean;
  readonly canSubmit: boolean;
};

function validateForm(
  name: string,
  dir: string,
  fileName: string,
  components: readonly { readonly name: string; readonly file: string }[],
): FormValidation {
  const trimmedName = name.trim();
  const trimmedFile = fileName.trim();
  const compName = toComponentName(trimmedName);
  const isNameValid = trimmedName.length > 0 && compName.length > 0;
  const lowerName = compName.toLowerCase();
  const isNameDuplicate = components.some((c) => c.name.toLowerCase() === lowerName);
  const normalized = normalizeFilePath(dir, trimmedFile).toLowerCase();
  const isFileDuplicate = components.some((c) => c.file.toLowerCase() === normalized);
  const canSubmit = isNameValid && !isNameDuplicate && !isFileDuplicate && trimmedFile.length > 0;
  return { isNameValid, isNameDuplicate, isFileDuplicate, canSubmit };
}

function resolveExtractError(err: unknown, tError: TFunction<'errors'>): string {
  const info = toErrorInfo(err);
  const details = info.details;
  const detailName =
    details instanceof Object && 'name' in details
      ? (details as { name?: unknown }).name
      : undefined;
  const varName = typeof detailName === 'string' ? detailName : info.params?.['name'];
  const params = varName ? { ...info.params, name: varName } : info.params;
  return errorText(tError, info.code, params);
}

async function submitExtract(
  target: Extract<InspectorTarget, { readonly kind: 'element' }>,
  name: string,
  dir: string,
  fileName: string,
  onExtracted?: (res: StructureResult) => void,
): Promise<StructureResult> {
  const tag = target.source?.tag ?? '';
  const res = await extractComponent({
    loc: target.ref.loc,
    tag,
    name: name.trim(),
    dir: dir.trim() || undefined,
    fileName: fileName.trim() || undefined,
  });
  if (res.locs.length === 0) {
    useSelectionStore.getState().clearSelection();
  }
  onExtracted?.(res);
  return res;
}

function useExtractSubmit(
  target: Extract<InspectorTarget, { readonly kind: 'element' }>,
  onClose: () => void,
  onExtracted?: (res: StructureResult) => void,
) {
  const { t: tError } = useTranslation('errors');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();

  const runSubmit = async (name: string, dir: string, fileName: string) => {
    setBusy(true);
    setErrorMsg(undefined);
    try {
      await submitExtract(target, name, dir, fileName, onExtracted);
      onClose();
    } catch (err) {
      setErrorMsg(resolveExtractError(err, tError));
    } finally {
      setBusy(false);
    }
  };

  return { busy, errorMsg, runSubmit };
}

function toPugComponentFileName(name: string): string {
  const kebab = name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return kebab === '' ? '' : `${kebab}.pug`;
}

function useExtractForm(
  target: Extract<InspectorTarget, { readonly kind: 'element' }>,
  onClose: () => void,
  onExtracted?: (res: StructureResult) => void,
) {
  const project = useProjectInfo();
  const isPug = project?.support.framework === 'express-pug';
  const defaultDir = isPug
    ? `${project.support.viewsDir ?? 'views'}/components`
    : (project?.designDirs.components[0] ?? 'src/components');
  const components = useComponentsStore((s) => s.components);
  const [name, setName] = useState('');
  const [dir, setDir] = useState(defaultDir);
  const [fileName, setFileName] = useState('');
  const [isFileManual, setIsFileManual] = useState(false);
  const { busy, errorMsg, runSubmit } = useExtractSubmit(target, onClose, onExtracted);
  const validation = validateForm(name, dir, fileName, components);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isFileManual) {
      setFileName(isPug ? toPugComponentFileName(val) : pageNames(val, 'ts').fileName);
    }
  };

  const handleFileChange = (val: string) => {
    setIsFileManual(true);
    setFileName(val);
  };

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (validation.canSubmit && !busy) {
      await runSubmit(name, dir, fileName);
    }
  };

  return {
    name,
    dir,
    fileName,
    busy,
    errorMsg,
    validation,
    setDir,
    handleNameChange,
    handleFileChange,
    handleSubmit,
  };
}

function ExtractNameField({ form }: { readonly form: ReturnType<typeof useExtractForm> }) {
  const { t } = useTranslation();
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-soft">
      {t('components.extract.name')}
      <input
        data-testid="extract-name"
        type="text"
        disabled={form.busy}
        value={form.name}
        onChange={(e) => {
          form.handleNameChange(e.target.value);
        }}
        placeholder={t('components.extract.namePlaceholder')}
        className="rounded border border-border bg-field px-2.5 py-1.5 text-xs text-ink disabled:opacity-50"
      />
      {form.name.trim().length > 0 && !form.validation.isNameValid && (
        <span className="text-[11px] text-danger">{t('components.extract.invalidPascal')}</span>
      )}
      {form.validation.isNameDuplicate && (
        <span className="text-[11px] text-danger">{t('components.extract.nameExists')}</span>
      )}
    </label>
  );
}

function ExtractFileField({ form }: { readonly form: ReturnType<typeof useExtractForm> }) {
  const { t } = useTranslation();
  return (
    <>
      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        {t('components.extract.dir')}
        <DirInputWithPicker
          dataTestId="extract-dir"
          disabled={form.busy}
          value={form.dir}
          onChange={form.setDir}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        {t('components.extract.file')}
        <input
          data-testid="extract-file"
          type="text"
          disabled={form.busy}
          value={form.fileName}
          onChange={(e) => {
            form.handleFileChange(e.target.value);
          }}
          className="rounded border border-border bg-field px-2.5 py-1.5 text-xs text-ink disabled:opacity-50"
        />
        {form.validation.isFileDuplicate && (
          <span className="text-[11px] text-danger">{t('components.extract.fileExists')}</span>
        )}
      </label>
    </>
  );
}

export function ExtractDialog({ open, target, onClose, onExtracted }: ExtractDialogProps) {
  const { t } = useTranslation();
  const form = useExtractForm(target, onClose, onExtracted);

  return (
    <Dialog
      open={open}
      title={t('components.extract.title')}
      closeLabel={t('components.extract.cancel')}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          void form.handleSubmit(e);
        }}
        className="flex flex-col gap-3"
      >
        <ExtractNameField form={form} />
        <ExtractFileField form={form} />
        {form.errorMsg !== undefined && (
          <div role="alert" data-testid="extract-error" className="text-xs text-danger">
            {form.errorMsg}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={form.busy}
            className="rounded border border-border px-3 py-1.5 text-xs text-ink-soft hover:bg-border/20 disabled:opacity-50"
          >
            {t('components.extract.cancel')}
          </button>
          <button
            data-testid="extract-submit"
            type="submit"
            disabled={!form.validation.canSubmit || form.busy}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50"
          >
            {form.busy ? t('components.extract.submitting') : t('components.extract.submit')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
