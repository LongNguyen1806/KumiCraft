import type { BackendInfo } from '@reactcraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorText, toErrorInfo } from '../../routes/error-text.ts';

function getStatusBadgeStyle(status: BackendInfo['status']): string {
  if (status === 'ok') return 'bg-emerald-50 text-emerald-700';
  if (status === 'blocked') return 'bg-rose-50 text-rose-700';
  return 'bg-amber-50 text-amber-700';
}

function BackendItem({
  backend,
  busy,
  onRemove,
}: {
  readonly backend: BackendInfo;
  readonly busy: boolean;
  readonly onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  const statusText =
    backend.status === 'ok'
      ? t('project.backends.statusOk')
      : backend.status === 'blocked'
        ? t('project.backends.statusBlocked')
        : t('project.backends.statusMissing');

  return (
    <div
      className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
      data-testid={`backend-item-${backend.id}`}
    >
      <div className="flex flex-col gap-0.5 min-w-0 flex-1 pr-2">
        <span className="text-xs font-medium text-ink truncate">{backend.label}</span>
        <span className="font-mono text-[11px] text-ink-faint truncate">{backend.path}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] uppercase font-semibold ${getStatusBadgeStyle(backend.status)}`}
        >
          {statusText}
        </span>
        <button
          type="button"
          onClick={() => {
            onRemove(backend.id);
          }}
          disabled={busy}
          className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          data-testid={`remove-backend-btn-${backend.id}`}
        >
          {t('project.backends.remove')}
        </button>
      </div>
    </div>
  );
}

function useAddBackendState(onAdd: (path: string, label?: string) => Promise<void>) {
  const { t: tError } = useTranslation('errors');
  const [newPath, setNewPath] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>();

  const handleAdd = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!newPath.trim()) return;
    setBusy(true);
    setErrorMsg(undefined);
    try {
      await onAdd(newPath.trim(), newLabel.trim() || undefined);
      setNewPath('');
      setNewLabel('');
    } catch (err) {
      const info = toErrorInfo(err);
      setErrorMsg(errorText(tError, info.code, info.params));
    } finally {
      setBusy(false);
    }
  };

  return { newPath, setNewPath, newLabel, setNewLabel, busy, errorMsg, handleAdd };
}

function AddBackendForm({
  onAdd,
}: {
  readonly onAdd: (path: string, label?: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const s = useAddBackendState(onAdd);

  return (
    <form
      onSubmit={(e) => {
        void s.handleAdd(e);
      }}
      className="flex flex-col gap-2 rounded-lg border border-border bg-field/40 p-3"
    >
      <span className="text-xs font-medium text-ink">{t('project.backends.add')}</span>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={s.newPath}
          onChange={(e) => {
            s.setNewPath(e.target.value);
          }}
          placeholder={t('project.backends.pathPlaceholder')}
          className="rounded border border-border bg-field px-2.5 py-1.5 text-xs text-ink focus:outline-none"
          data-testid="backend-path-input"
        />
        <input
          type="text"
          value={s.newLabel}
          onChange={(e) => {
            s.setNewLabel(e.target.value);
          }}
          placeholder={t('project.backends.labelPlaceholder')}
          className="rounded border border-border bg-field px-2.5 py-1.5 text-xs text-ink focus:outline-none"
          data-testid="backend-label-input"
        />
      </div>
      {s.errorMsg && <p className="text-xs text-rose-600">{s.errorMsg}</p>}
      <button
        type="submit"
        disabled={s.busy || !s.newPath.trim()}
        className="self-end rounded-lg bg-charcoal px-3 py-1.5 text-xs text-on-charcoal disabled:opacity-50"
        data-testid="add-backend-btn"
      >
        {t('project.backends.add')}
      </button>
    </form>
  );
}

type BackendsViewProps = {
  readonly backends: readonly BackendInfo[];
  readonly onAddBackend: (path: string, label?: string) => Promise<void>;
  readonly onRemoveBackend: (id: string) => Promise<void>;
};

export function BackendsView({ backends, onAddBackend, onRemoveBackend }: BackendsViewProps) {
  const { t } = useTranslation();
  const [removeBusy, setRemoveBusy] = useState(false);

  const handleRemove = async (id: string) => {
    if (!window.confirm(t('project.backends.confirmRemove'))) return;
    setRemoveBusy(true);
    try {
      await onRemoveBackend(id);
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="backends-view">
      <h3 className="text-sm font-medium text-ink">{t('project.backends.title')}</h3>

      <div className="flex flex-col gap-2" data-testid="backends-list">
        {backends.length === 0 ? (
          <p className="text-xs text-ink-faint">{t('project.backends.empty')}</p>
        ) : (
          backends.map((b) => (
            <BackendItem
              key={b.id}
              backend={b}
              busy={removeBusy}
              onRemove={(id) => {
                void handleRemove(id);
              }}
            />
          ))
        )}
      </div>

      <AddBackendForm onAdd={onAddBackend} />
    </div>
  );
}
