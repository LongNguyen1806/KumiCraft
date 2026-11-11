// Project trust in the Studio (SPEC-05 S-80, S-81): an untrusted project opens in restricted mode,
// where nothing of the project runs. The first time in a tab the Studio asks; afterwards a bar
// stays on top. The list of linked backends comes with GET /project (WP-1.03).
import type { BackendInfo } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { setProjectTrust } from '../../api/project-client.ts';
import { Dialog } from '../../components/ui/dialog.tsx';
import { type ErrorInfo, errorText, toErrorInfo } from '../../routes/error-text.ts';

const askedKey = (id: string) => `kumicraft.trustAsked.${id}`;

function wasAsked(id: string): boolean {
  try {
    return sessionStorage.getItem(askedKey(id)) === '1';
  } catch {
    return false;
  }
}

function rememberAsked(id: string): void {
  try {
    sessionStorage.setItem(askedKey(id), '1');
  } catch {
    // The question comes back on the next load; nothing is lost.
  }
}

type TrustPromptProps = {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectRoot?: string | undefined;
  readonly backends?: readonly BackendInfo[] | undefined;
  /** Reads the session again once the project is trusted. */
  readonly onTrusted: () => void;
};

/** Warning bar of restricted mode, and the trust question (shown once per tab at first). */
export function TrustPrompt({
  projectId,
  projectName,
  projectRoot,
  backends,
  onTrusted,
}: TrustPromptProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => !wasAsked(projectId));
  const close = () => {
    rememberAsked(projectId);
    setOpen(false);
  };
  return (
    <>
      <div
        role="status"
        className="flex shrink-0 items-center gap-3 border-b border-line bg-sun-soft py-1 pr-2 pl-4 text-xs text-ink"
        data-testid="trust-bar"
      >
        <p className="min-w-0 flex-1">{t('trust.bar')}</p>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
          className="h-7 shrink-0 rounded-md bg-charcoal px-3 font-medium text-on-charcoal hover:bg-primary-hover"
        >
          {t('trust.review')}
        </button>
      </div>
      <TrustDialog
        open={open}
        projectName={projectName}
        projectRoot={projectRoot}
        backends={backends}
        onClose={close}
        onTrusted={onTrusted}
      />
    </>
  );
}

function TrustBackendItem({ backend }: { readonly backend: BackendInfo }) {
  const { t } = useTranslation();
  return (
    <li className="flex flex-col gap-0.5" data-testid="trust-backend">
      <span className="font-medium">{backend.label}</span>
      <span className="font-mono text-xs text-ink-soft break-all">{backend.resolvedPath}</span>
      {backend.outsideParent && (
        <span
          role="note"
          className="text-xs font-medium text-warn"
          data-testid="trust-backend-outside"
        >
          {t('trust.backendOutside')}
        </span>
      )}
      {backend.status !== 'ok' && (
        <span className="text-xs text-danger" data-testid="trust-backend-status">
          {backend.status === 'missing'
            ? t('trust.backendStatus.missing')
            : t('trust.backendStatus.blocked')}
        </span>
      )}
    </li>
  );
}

function TrustBackends({ backends }: { readonly backends?: readonly BackendInfo[] | undefined }) {
  const { t } = useTranslation();
  if (backends === undefined) {
    return (
      <p className="grid gap-0.5 rounded-lg bg-field px-4 py-2.5">
        <span className="text-xs text-ink-faint">{t('trust.backends')}</span>
        <span className="text-xs text-ink-soft" data-testid="trust-loading">
          {t('trust.loading')}
        </span>
      </p>
    );
  }
  if (backends.length === 0) {
    return (
      <p className="grid gap-0.5 rounded-lg bg-field px-4 py-2.5">
        <span className="text-xs text-ink-faint">{t('trust.backends')}</span>
        <span className="text-xs text-ink-soft" data-testid="trust-no-backends">
          {t('trust.noBackends')}
        </span>
      </p>
    );
  }
  return (
    <div className="grid gap-1.5 rounded-lg bg-field px-4 py-2.5">
      <span className="text-xs text-ink-faint">{t('trust.backends')}</span>
      <ul className="flex flex-col gap-2" data-testid="trust-backends">
        {backends.map((b) => (
          <TrustBackendItem key={b.id} backend={b} />
        ))}
      </ul>
    </div>
  );
}

function TrustDialogBody({
  projectName,
  projectRoot,
  backends,
  failedInfo,
}: {
  readonly projectName: string;
  readonly projectRoot?: string | undefined;
  readonly backends?: readonly BackendInfo[] | undefined;
  readonly failedInfo?: ErrorInfo | undefined;
}) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  return (
    <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
      <p className="text-ink-soft">{t('trust.intro')}</p>
      <p className="grid gap-0.5 rounded-lg bg-field px-4 py-2.5">
        <span className="text-xs text-ink-faint">{t('trust.project')}</span>
        <span className="font-medium break-all" data-testid="trust-project">
          {projectName}
        </span>
      </p>
      {projectRoot !== undefined && (
        <p className="grid gap-0.5 rounded-lg bg-field px-4 py-2.5">
          <span className="text-xs text-ink-faint">{t('trust.root')}</span>
          <span className="font-mono text-xs break-all" data-testid="trust-root">
            {projectRoot}
          </span>
        </p>
      )}
      <TrustBackends backends={backends} />
      <p className="pt-1 text-xs text-ink-faint">{t('trust.restricted')}</p>
      {failedInfo !== undefined && (
        <p role="alert" className="text-danger">
          {errorText(tError, failedInfo.code, failedInfo.params)}
        </p>
      )}
    </div>
  );
}

type TrustDialogProps = {
  readonly open: boolean;
  readonly projectName: string;
  readonly projectRoot?: string | undefined;
  readonly backends?: readonly BackendInfo[] | undefined;
  readonly onClose: () => void;
  readonly onTrusted: () => void;
};

function TrustDialog({
  open,
  projectName,
  projectRoot,
  backends,
  onClose,
  onTrusted,
}: TrustDialogProps) {
  const { t } = useTranslation();
  const [failedInfo, setFailedInfo] = useState<ErrorInfo>();
  const trust = async () => {
    try {
      await setProjectTrust(true);
      onClose();
      onTrusted();
    } catch (error) {
      setFailedInfo(toErrorInfo(error));
    }
  };
  return (
    <Dialog open={open} title={t('trust.title')} closeLabel={t('trust.close')} onClose={onClose}>
      <TrustDialogBody
        projectName={projectName}
        projectRoot={projectRoot}
        backends={backends}
        failedInfo={failedInfo}
      />
      <div className="flex flex-wrap gap-2 pt-3">
        <button
          type="button"
          onClick={() => void trust()}
          className="h-8 rounded-md bg-sun px-4 font-medium text-on-sun"
        >
          {t('trust.confirm')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-md bg-field px-4 text-ink-soft"
        >
          {t('trust.later')}
        </button>
      </div>
    </Dialog>
  );
}
