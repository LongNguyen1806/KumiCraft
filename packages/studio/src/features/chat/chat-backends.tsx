// Backend chips and directory browser dialog for chat panel (WP-3.05a, R-CH-07).
import type { BackendInfo } from '@reactcraft/shared';
import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { addProjectBackend, fetchProject, removeProjectBackend } from '../../api/project-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { DirectoryBrowser } from '../project/directory-browser.tsx';

type BackendChipProps = {
  readonly backend: BackendInfo;
  readonly onRemove: (id: string) => void;
};

function BackendChip({ backend, onRemove }: BackendChipProps) {
  const { t } = useTranslation('chat');
  return (
    <span
      data-testid={`chat-backend-${backend.id}`}
      className="inline-flex items-center gap-1 rounded-full bg-field px-2.5 py-0.5 text-[11px] text-ink-soft"
    >
      <span className="truncate max-w-[150px]">{backend.label}</span>
      <button
        type="button"
        aria-label={t('remove')}
        onClick={() => {
          onRemove(backend.id);
        }}
        className="rounded-full p-0.5 hover:bg-field-hover text-ink-faint hover:text-ink cursor-pointer"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

type AddBackendDialogProps = {
  readonly onClose: () => void;
  readonly onAdded: () => void;
  readonly onFail: (message: string) => void;
};

function AddBackendDialog({ onClose, onAdded, onFail }: AddBackendDialogProps) {
  const { t } = useTranslation('chat');
  const { t: tError } = useTranslation('errors');
  const [selectedPath, setSelectedPath] = useState('');

  const handleConfirm = async () => {
    if (!selectedPath) return;
    try {
      await addProjectBackend(selectedPath);
      onAdded();
      onClose();
    } catch (err) {
      const info = toErrorInfo(err);
      onFail(errorText(tError, info.code, info.params));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="flex flex-col gap-4 w-full max-w-lg rounded-panel bg-card p-5 shadow-elevated">
        <h3 className="text-sm font-semibold text-ink">{t('selectFolder')}</h3>
        <DirectoryBrowser
          currentPath={selectedPath}
          onSelectPath={(path) => {
            setSelectedPath(path);
          }}
        />
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-xs text-ink-soft hover:bg-field"
          >
            {t('cancelBackend')}
          </button>
          <button
            type="button"
            data-testid="chat-backend-confirm"
            disabled={!selectedPath}
            onClick={() => {
              void handleConfirm();
            }}
            className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-40 cursor-pointer"
          >
            {t('confirmBackend')}
          </button>
        </div>
      </div>
    </div>
  );
}

function useProjectBackends() {
  const [backends, setBackends] = useState<readonly BackendInfo[]>([]);

  const reload = async () => {
    try {
      const project = await fetchProject();
      setBackends(project.backends);
    } catch {
      // Ignore background load failures
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const project = await fetchProject();
        if (active) setBackends(project.backends);
      } catch {
        // Ignore background load failures
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return { backends, reload };
}

type BackendChipsBarProps = {
  readonly backends: readonly BackendInfo[];
  readonly onAdd: () => void;
  readonly onRemove: (id: string) => void;
};

function BackendChipsBar({ backends, onAdd, onRemove }: BackendChipsBarProps) {
  const { t } = useTranslation('chat');
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        data-testid="chat-add-backend"
        onClick={onAdd}
        className="inline-flex items-center gap-1 rounded-full bg-field px-2.5 py-0.5 text-[11px] text-ink-soft hover:bg-field-hover hover:text-ink cursor-pointer"
      >
        <Plus className="size-3" />
        <span>{t('addBackend')}</span>
      </button>
      {backends.map((b) => (
        <BackendChip
          key={b.id}
          backend={b}
          onRemove={(id) => {
            onRemove(id);
          }}
        />
      ))}
    </div>
  );
}

export function ChatBackends() {
  const { backends, reload } = useProjectBackends();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const handleRemove = async (id: string) => {
    try {
      await removeProjectBackend(id);
      await reload();
    } catch {
      // Ignore remove errors
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <BackendChipsBar
        backends={backends}
        onAdd={() => {
          setErrorMessage(undefined);
          setDialogOpen(true);
        }}
        onRemove={(id) => {
          void handleRemove(id);
        }}
      />
      {errorMessage !== undefined && (
        <p data-testid="chat-backend-error" className="text-xs text-rose-600">
          {errorMessage}
        </p>
      )}
      {dialogOpen && (
        <AddBackendDialog
          onClose={() => {
            setDialogOpen(false);
          }}
          onAdded={() => {
            void reload();
          }}
          onFail={(msg) => {
            setErrorMessage(msg);
          }}
        />
      )}
    </div>
  );
}
