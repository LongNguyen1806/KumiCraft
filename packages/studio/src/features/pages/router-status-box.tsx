// Router status banner and actions in the Pages panel (Phase 4 K3d-B section 3.6).
import type { RouterStatus } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { installProjectRouter, patchProject } from '../../api/project-client.ts';
import { useProjectStore } from '../../core/project-store.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { FolderPicker } from '../files/folder-picker.tsx';
import { useInstallJob } from '../project/use-install-job.ts';

const ROUTER_EXTENSIONS = ['.jsx', '.tsx', '.js', '.ts'] as const;

type RouterFoundBarProps = {
  readonly file: string;
  readonly chosen: boolean;
  readonly busy: boolean;
  readonly onOpenPicker: () => void;
  readonly onAutoDetect: () => void;
};

function RouterFoundBar({ file, chosen, busy, onOpenPicker, onAutoDetect }: RouterFoundBarProps) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="router-status-found"
      className="flex flex-wrap items-center justify-between gap-2 rounded-[7px] border border-line bg-card-solid px-2.5 py-1.5 text-xs"
    >
      <span className="truncate font-mono text-[11px] text-ink-soft">
        {t('pages.routerFile', { file })}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          data-testid="router-change-file"
          disabled={busy}
          onClick={onOpenPicker}
          className="h-6 rounded-md border border-line bg-card-solid px-2 hover:bg-field text-ink-soft hover:text-ink disabled:opacity-40"
        >
          {t('pages.changeRouterFile')}
        </button>
        {chosen ? (
          <button
            type="button"
            data-testid="router-auto-file"
            disabled={busy}
            onClick={onAutoDetect}
            className="h-6 rounded-md border border-line bg-card-solid px-2 hover:bg-field text-ink-soft hover:text-ink disabled:opacity-40"
          >
            {t('pages.autoRouterFile')}
          </button>
        ) : undefined}
      </div>
    </div>
  );
}

type RouterAmbiguousBoxProps = {
  readonly candidates: readonly string[];
  readonly busy: boolean;
  readonly onSelectFile: (file: string) => void;
  readonly onOpenPicker: () => void;
};

function RouterAmbiguousBox({
  candidates,
  busy,
  onSelectFile,
  onOpenPicker,
}: RouterAmbiguousBoxProps) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="pages-not-convention"
      role="note"
      className="flex flex-col gap-2 rounded-md border border-sun bg-sun-soft p-2.5 text-ink"
    >
      <div>{t('pages.routerAmbiguous')}</div>
      <div className="flex flex-wrap gap-1.5">
        {candidates.map((candidate) => (
          <button
            key={candidate}
            type="button"
            data-testid={`router-candidate-${candidate}`}
            disabled={busy}
            onClick={() => {
              onSelectFile(candidate);
            }}
            className="h-7 rounded-md border border-line bg-card-solid px-2 font-mono text-[11px] text-ink hover:bg-field disabled:opacity-40"
          >
            {candidate}
          </button>
        ))}
        <button
          type="button"
          data-testid="router-pick-tree"
          disabled={busy}
          onClick={onOpenPicker}
          className="h-7 rounded-md border border-line bg-card-solid px-2 hover:bg-field text-ink-soft hover:text-ink disabled:opacity-40"
        >
          {t('pages.pickOnTree')}
        </button>
      </div>
    </div>
  );
}

type RouterUnsupportedBoxProps = {
  readonly file: string;
  readonly reason: 'generated' | 'noRoutes' | 'parseError';
  readonly busy: boolean;
  readonly onOpenPicker: () => void;
};

function RouterUnsupportedBox({ file, reason, busy, onOpenPicker }: RouterUnsupportedBoxProps) {
  const { t } = useTranslation();
  const reasonText = t(`pages.routerUnsupportedReason.${reason}`);
  return (
    <div
      data-testid="pages-not-convention"
      role="note"
      className="flex flex-col gap-2 rounded-md border border-sun bg-sun-soft p-2.5 text-ink"
    >
      <div>{t('pages.routerUnsupported', { file, reason: reasonText })}</div>
      <div>
        <button
          type="button"
          data-testid="router-pick-another"
          disabled={busy}
          onClick={onOpenPicker}
          className="h-7 rounded-md border border-line bg-card-solid px-2 hover:bg-field text-ink-soft hover:text-ink disabled:opacity-40"
        >
          {t('pages.pickAnotherFile')}
        </button>
      </div>
    </div>
  );
}

function RouterInstallDialogButtons({
  running,
  onCancel,
  onConfirm,
}: {
  readonly running: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end gap-1.5">
      <button
        type="button"
        data-testid="router-install-cancel"
        disabled={running}
        onClick={onCancel}
        className="h-7 rounded-md border border-line bg-card-solid px-2.5 hover:bg-field text-ink-soft hover:text-ink disabled:opacity-40"
      >
        {t('pages.cancel')}
      </button>
      <button
        type="button"
        data-testid="router-install-confirm"
        disabled={running}
        onClick={onConfirm}
        className="h-7 rounded-md bg-charcoal px-3 font-medium text-on-charcoal hover:bg-accent-hover disabled:opacity-40"
      >
        {running ? t('pages.installRouterRunning') : t('pages.installRouterConfirm')}
      </button>
    </div>
  );
}

function RouterInstallDialog({
  lines,
  running,
  onCancel,
  onConfirm,
}: {
  readonly lines: readonly string[];
  readonly running: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="router-install-dialog"
      className="flex flex-col gap-2 rounded-[7px] border border-line bg-card-solid p-2.5 text-xs text-ink"
    >
      <div className="font-semibold">{t('pages.installRouterTitle')}</div>
      <ol className="list-decimal pl-4 space-y-1 text-ink-soft">
        <li>{t('pages.installRouterStep1')}</li>
        <li>{t('pages.installRouterStep2')}</li>
        <li>{t('pages.installRouterStep3')}</li>
      </ol>
      <div className="text-[11px] text-ink-faint">{t('pages.installRouterUndoHint')}</div>
      {lines.length > 0 ? (
        <pre className="max-h-24 overflow-auto rounded bg-field p-1.5 font-mono text-[10px] text-ink-soft">
          {lines.join('\n')}
        </pre>
      ) : undefined}
      <RouterInstallDialogButtons running={running} onCancel={onCancel} onConfirm={onConfirm} />
    </div>
  );
}

function RouterNoneBoxHeader({
  confirmOpen,
  running,
  onOpenConfirm,
}: {
  readonly confirmOpen: boolean;
  readonly running: boolean;
  readonly onOpenConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{t('pages.routerNone')}</span>
      {!confirmOpen ? (
        <button
          type="button"
          data-testid="router-install-btn"
          disabled={running}
          onClick={onOpenConfirm}
          className="shrink-0 h-7 rounded-md bg-charcoal px-3 font-medium text-on-charcoal hover:bg-accent-hover disabled:opacity-40"
        >
          {running ? t('pages.installRouterRunning') : t('pages.installRouter')}
        </button>
      ) : undefined}
    </div>
  );
}

function RouterNoneBox({ onInstalled }: { readonly onInstalled: () => void }) {
  const { t: tError } = useTranslation('errors');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const job = useInstallJob(
    [],
    () => {
      setConfirmOpen(false);
      onInstalled();
    },
    () => installProjectRouter(),
  );
  const running = job.phase === 'starting' || job.phase === 'running';

  return (
    <div
      data-testid="pages-not-convention"
      role="note"
      className="flex flex-col gap-2 rounded-md border border-sun bg-sun-soft p-2.5 text-ink"
    >
      <RouterNoneBoxHeader
        confirmOpen={confirmOpen}
        running={running}
        onOpenConfirm={() => {
          setConfirmOpen(true);
        }}
      />
      {confirmOpen ? (
        <RouterInstallDialog
          lines={job.lines}
          running={running}
          onCancel={() => {
            setConfirmOpen(false);
          }}
          onConfirm={() => {
            void job.start();
          }}
        />
      ) : undefined}
      {job.failure !== undefined ? (
        <div role="alert" data-testid="router-action-error" className="text-xs text-danger">
          {errorText(tError, job.failure.code, job.failure.params)}
        </div>
      ) : undefined}
    </div>
  );
}

type RouterStatusContentProps = {
  readonly router: RouterStatus;
  readonly busy: boolean;
  readonly onOpenPicker: () => void;
  readonly onUpdateRouting: (file?: string) => void;
  readonly onRouterChanged?: (() => void) | undefined;
};

function RouterStatusContent({
  router,
  busy,
  onOpenPicker,
  onUpdateRouting,
  onRouterChanged,
}: RouterStatusContentProps) {
  if (router.status === 'found') {
    return (
      <RouterFoundBar
        file={router.file}
        chosen={router.chosen}
        busy={busy}
        onOpenPicker={onOpenPicker}
        onAutoDetect={() => {
          onUpdateRouting(undefined);
        }}
      />
    );
  }
  if (router.status === 'ambiguous') {
    return (
      <RouterAmbiguousBox
        candidates={router.candidates}
        busy={busy}
        onSelectFile={onUpdateRouting}
        onOpenPicker={onOpenPicker}
      />
    );
  }
  if (router.status === 'unsupported') {
    return (
      <RouterUnsupportedBox
        file={router.file}
        reason={router.reason}
        busy={busy}
        onOpenPicker={onOpenPicker}
      />
    );
  }
  return <RouterNoneBox onInstalled={() => onRouterChanged?.()} />;
}

export type RouterStatusBoxProps = {
  readonly router: RouterStatus;
  readonly onRouterChanged?: (() => void) | undefined;
};

function useRouterStatusActions(onRouterChanged?: () => void) {
  const { t: tError } = useTranslation('errors');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();

  const updateRouting = async (file?: string) => {
    setBusy(true);
    setActionError(undefined);
    try {
      const info = await patchProject({ routing: file !== undefined ? { file } : {} });
      useProjectStore.getState().setProject(info);
      onRouterChanged?.();
    } catch (error: unknown) {
      const errInfo = toErrorInfo(error);
      setActionError(errorText(tError, errInfo.code, errInfo.params));
    } finally {
      setBusy(false);
    }
  };

  return { pickerOpen, setPickerOpen, busy, actionError, updateRouting };
}

export function RouterStatusBox({ router, onRouterChanged }: RouterStatusBoxProps) {
  const s = useRouterStatusActions(onRouterChanged);

  return (
    <div className="flex flex-col gap-1.5">
      <RouterStatusContent
        router={router}
        busy={s.busy}
        onOpenPicker={() => {
          s.setPickerOpen(true);
        }}
        onUpdateRouting={(file) => {
          void s.updateRouting(file);
        }}
        onRouterChanged={onRouterChanged}
      />
      {s.actionError !== undefined ? (
        <div role="alert" data-testid="router-action-error" className="text-xs text-danger">
          {s.actionError}
        </div>
      ) : undefined}
      <FolderPicker
        open={s.pickerOpen}
        mode="file"
        extensions={ROUTER_EXTENSIONS}
        onPick={(file) => {
          s.setPickerOpen(false);
          void s.updateRouting(file);
        }}
        onClose={() => {
          s.setPickerOpen(false);
        }}
      />
    </div>
  );
}
