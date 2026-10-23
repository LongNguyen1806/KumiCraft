// Dialog for importing a folder or document into chat (R-CH-02, R-MR-01).
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { addProjectBackend, fetchProject } from '../../api/project-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { DirectoryBrowser } from '../project/directory-browser.tsx';
import { useChatStore } from './chat-store.ts';
import { classifyImport, type ImportTarget } from './import-path.ts';

export type ImportDialogProps = {
  readonly projectRoot?: string | undefined;
  readonly onClose: () => void;
  readonly onBackendAdded?: (() => void) | undefined;
};

function useImportRoot(projectRoot?: string): string {
  const [loadedRoot, setLoadedRoot] = useState('');
  useEffect(() => {
    if (projectRoot) return;
    let active = true;
    const load = async () => {
      try {
        const p = await fetchProject();
        if (active) setLoadedRoot(p.root);
      } catch {
        // Handled silently
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [projectRoot]);
  return projectRoot ?? loadedRoot;
}

function resolveHint(target: ImportTarget, t: TFunction<'chat'>) {
  if (target.kind === 'doc') return t('import.hintDoc', { path: target.relPath });
  if (target.kind === 'backend') return t('import.hintBackend', { path: target.path });
  if (target.kind === 'projectRoot') return t('import.hintRoot');
  return undefined;
}

type DialogFieldsProps = {
  readonly root: string;
  readonly inputPath: string;
  readonly hint?: string | undefined;
  readonly errorMessage?: string | undefined;
  readonly setInputPath: (path: string) => void;
};

function DialogFields({ root, inputPath, hint, errorMessage, setInputPath }: DialogFieldsProps) {
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <input
        type="text"
        data-testid="chat-import-path"
        value={inputPath}
        onChange={(e) => {
          setInputPath(e.target.value);
        }}
        placeholder={root}
        className="w-full rounded-md border border-border bg-field px-2.5 py-1.5 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-ink-soft focus:outline-none"
      />
      {hint !== undefined && (
        <p data-testid="chat-import-hint" className="text-xs text-ink-soft">
          {hint}
        </p>
      )}
      {errorMessage !== undefined && (
        <p data-testid="chat-import-error" className="text-xs text-danger">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

type DialogActionsProps = {
  readonly canConfirm: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
};

function DialogActions({ canConfirm, onClose, onConfirm }: DialogActionsProps) {
  const { t } = useTranslation('chat');
  return (
    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
      <button
        type="button"
        data-testid="chat-import-cancel"
        onClick={onClose}
        className="rounded-full px-3 py-1.5 text-xs text-ink-soft hover:bg-field cursor-pointer"
      >
        {t('import.cancel')}
      </button>
      <button
        type="button"
        data-testid="chat-import-confirm"
        disabled={!canConfirm}
        onClick={onConfirm}
        className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-on-charcoal hover:bg-primary-hover disabled:opacity-40 cursor-pointer"
      >
        {t('import.add')}
      </button>
    </div>
  );
}

async function submitTarget(
  target: ImportTarget,
  tError: TFunction<'errors'>,
  onClose: () => void,
  onBackendAdded?: () => void,
): Promise<string | undefined> {
  if (target.kind === 'doc') {
    useChatStore.getState().addDoc(target.relPath);
    onClose();
    return undefined;
  }
  if (target.kind === 'backend') {
    try {
      await addProjectBackend(target.path);
      onBackendAdded?.();
      onClose();
      return undefined;
    } catch (err) {
      const info = toErrorInfo(err);
      return errorText(tError, info.code, info.params);
    }
  }
  return undefined;
}

export function ImportDialog({ projectRoot, onClose, onBackendAdded }: ImportDialogProps) {
  const { t } = useTranslation('chat');
  const { t: tError } = useTranslation('errors');
  const root = useImportRoot(projectRoot);
  const [inputPath, setInputPath] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const target = classifyImport(root, inputPath);
  const hint = resolveHint(target, t);

  const handleConfirm = async () => {
    setSubmitting(true);
    setErrorMessage(undefined);
    const err = await submitTarget(target, tError, onClose, onBackendAdded);
    if (err !== undefined) setErrorMessage(err);
    setSubmitting(false);
  };

  return (
    <div
      data-testid="chat-import-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
    >
      <div className="flex flex-col gap-3 w-full max-w-lg rounded-panel bg-card p-5 shadow-elevated">
        <h3 className="text-sm font-semibold text-ink">{t('import.title')}</h3>
        <DirectoryBrowser
          currentPath={inputPath || root}
          onSelectPath={(path) => {
            setInputPath(path);
          }}
        />
        <DialogFields
          root={root}
          inputPath={inputPath}
          hint={hint}
          errorMessage={errorMessage}
          setInputPath={setInputPath}
        />
        <DialogActions
          canConfirm={!submitting && (target.kind === 'doc' || target.kind === 'backend')}
          onClose={onClose}
          onConfirm={() => {
            void handleConfirm();
          }}
        />
      </div>
    </div>
  );
}
