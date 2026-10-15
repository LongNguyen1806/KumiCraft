import type { BackendInfo } from '@reactcraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type BackendsViewProps = {
  readonly backends: readonly BackendInfo[];
  readonly onAddBackend: (path: string, label?: string) => Promise<void>;
  readonly onRemoveBackend: (id: string) => Promise<void>;
};

export function BackendsView({ backends, onAddBackend, onRemoveBackend }: BackendsViewProps) {
  const { t } = useTranslation();
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
      await onAddBackend(newPath.trim(), newLabel.trim() || undefined);
      setNewPath('');
      setNewLabel('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('project.backends.addFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm(t('project.backends.confirmRemove'))) return;
    setBusy(true);
    try {
      await onRemoveBackend(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="backends-view">
      <h3 className="text-sm font-medium text-ink">{t('project.backends.title')}</h3>

      {/* List */}
      <div className="flex flex-col gap-2" data-testid="backends-list">
        {backends.length === 0 ? (
          <p className="text-xs text-ink-faint">{t('project.backends.empty')}</p>
        ) : (
          backends.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
              data-testid={`backend-item-${b.id}`}
            >
              <div className="flex flex-col gap-0.5 min-w-0 flex-1 pr-2">
                <span className="text-xs font-medium text-ink truncate">{b.label}</span>
                <span className="font-mono text-[11px] text-ink-faint truncate">{b.path}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] uppercase font-semibold ${
                    b.status === 'ok'
                      ? 'bg-emerald-50 text-emerald-700'
                      : b.status === 'blocked'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {b.status === 'ok'
                    ? t('project.backends.statusOk')
                    : b.status === 'blocked'
                      ? t('project.backends.statusBlocked')
                      : t('project.backends.statusMissing')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void handleRemove(b.id);
                  }}
                  disabled={busy}
                  className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  data-testid={`remove-backend-btn-${b.id}`}
                >
                  {t('project.backends.remove')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add backend form */}
      <form
        onSubmit={(e) => {
          void handleAdd(e);
        }}
        className="flex flex-col gap-2 rounded-lg border border-border bg-field/40 p-3"
      >
        <span className="text-xs font-medium text-ink">{t('project.backends.add')}</span>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={newPath}
            onChange={(e) => {
              setNewPath(e.target.value);
            }}
            placeholder={t('project.backends.pathPlaceholder')}
            className="rounded border border-border bg-field px-2.5 py-1.5 text-xs text-ink focus:outline-none"
            data-testid="backend-path-input"
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => {
              setNewLabel(e.target.value);
            }}
            placeholder={t('project.backends.labelPlaceholder')}
            className="rounded border border-border bg-field px-2.5 py-1.5 text-xs text-ink focus:outline-none"
            data-testid="backend-label-input"
          />
        </div>
        {errorMsg && <p className="text-xs text-rose-600">{errorMsg}</p>}
        <button
          type="submit"
          disabled={busy || !newPath.trim()}
          className="self-end rounded-lg bg-charcoal px-3 py-1.5 text-xs text-on-charcoal disabled:opacity-50"
          data-testid="add-backend-btn"
        >
          {t('project.backends.add')}
        </button>
      </form>
    </div>
  );
}
