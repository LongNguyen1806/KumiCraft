// Revert turn button, confirmation dialog, and error reporting (WP-3.05b, R-CH-04).
import type { TurnSummary } from '@kumicraft/shared';
import type { TFunction } from 'i18next';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { revertTurn } from '../../api/agent-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { useChatStore } from './chat-store.ts';

export type ChatRevertProps = {
  readonly turnId: string;
  readonly summary: TurnSummary;
};

function formatRevertError(err: unknown, tError: TFunction<'errors'>): string {
  const info = toErrorInfo(err);
  const baseText = errorText(tError, info.code, info.params);
  const file = typeof info.params?.['file'] === 'string' ? info.params['file'] : undefined;
  return file !== undefined ? `${file}: ${baseText}` : baseText;
}

function RevertButton({ onClick }: { readonly onClick: () => void }) {
  const { t } = useTranslation('chat');
  return (
    <div className="flex items-center">
      <button
        type="button"
        data-testid="chat-revert"
        onClick={onClick}
        className="flex items-center gap-1.5 rounded-md bg-field px-2.5 h-6 text-xs text-ink-soft hover:bg-field-hover hover:text-ink"
      >
        <RotateCcw className="size-3" />
        <span>{t('revertTurn')}</span>
      </button>
    </div>
  );
}

function RevertConfirmDialog({
  fileCount,
  onCancel,
  onConfirm,
  busy,
}: {
  readonly fileCount: number;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly busy: boolean;
}) {
  const { t } = useTranslation('chat');

  return (
    <div
      data-testid="chat-revert-dialog"
      role="dialog"
      aria-modal="true"
      className="flex flex-col gap-2 rounded-panel border border-line bg-card-solid p-3 text-xs shadow-soft"
    >
      <p className="text-ink">{t('revertConfirmPrompt', { count: fileCount })}</p>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          data-testid="chat-revert-cancel"
          disabled={busy}
          onClick={onCancel}
          className="rounded px-2.5 py-1 text-ink-soft hover:bg-field hover:text-ink cursor-pointer"
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          data-testid="chat-revert-confirm"
          disabled={busy}
          onClick={onConfirm}
          className="rounded bg-rose-600 px-2.5 py-1 text-white hover:bg-rose-700 cursor-pointer font-medium"
        >
          {t('confirmRevert')}
        </button>
      </div>
    </div>
  );
}

function useRevertAction(turnId: string) {
  const { t: tError } = useTranslation('errors');
  const [reverted, setReverted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>();

  const executeRevert = async (onDone: () => void) => {
    setBusy(true);
    setErrorMsg(undefined);
    try {
      const updated = await revertTurn(turnId);
      useChatStore.getState().markReverted(turnId, updated);
      setReverted(true);
      onDone();
    } catch (err) {
      onDone();
      setErrorMsg(formatRevertError(err, tError));
    } finally {
      setBusy(false);
    }
  };

  return { reverted, busy, errorMsg, executeRevert };
}

export function ChatRevert({ turnId, summary }: ChatRevertProps) {
  const { t } = useTranslation('chat');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { reverted, busy, errorMsg, executeRevert } = useRevertAction(turnId);

  if (reverted) {
    return (
      <div data-testid="chat-reverted" className="text-xs text-ink-faint italic pt-1">
        {t('reverted')}
      </div>
    );
  }

  if (!summary.revertible) return undefined;

  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <RevertButton
        onClick={() => {
          setDialogOpen(true);
        }}
      />
      {errorMsg !== undefined && (
        <div
          data-testid="chat-revert-error"
          className="text-xs text-danger bg-rose-50/70 p-2 rounded border border-rose-200"
        >
          {errorMsg}
        </div>
      )}
      {dialogOpen && (
        <RevertConfirmDialog
          fileCount={summary.files.length}
          onCancel={() => {
            setDialogOpen(false);
          }}
          onConfirm={() => {
            void executeRevert(() => {
              setDialogOpen(false);
            });
          }}
          busy={busy}
        />
      )}
    </div>
  );
}
