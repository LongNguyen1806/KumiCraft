// Project trust in the Studio (SPEC-05 S-80, S-81): an untrusted project opens in restricted mode,
// where nothing of the project runs. The first time in a tab the Studio asks; afterwards a bar
// stays on top. The list of linked backends comes with GET /project (WP-1.03).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../api/http.ts';
import { setProjectTrust } from '../../api/project-client.ts';
import { Dialog } from '../../components/ui/dialog.tsx';
import { errorText } from '../../routes/error-text.ts';

const askedKey = (id: string) => `reactcraft.trustAsked.${id}`;

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
  /** Reads the session again once the project is trusted. */
  readonly onTrusted: () => void;
};

/** Warning bar of restricted mode, and the trust question (shown once per tab at first). */
export function TrustPrompt({ projectId, projectName, onTrusted }: TrustPromptProps) {
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
        className="flex items-center gap-3 rounded-full bg-sun-soft py-1.5 pr-1.5 pl-5 text-ink"
        data-testid="trust-bar"
      >
        <p className="min-w-0 flex-1">{t('trust.bar')}</p>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
          className="h-8 shrink-0 rounded-full bg-charcoal px-4 text-on-charcoal"
        >
          {t('trust.review')}
        </button>
      </div>
      <TrustDialog open={open} projectName={projectName} onClose={close} onTrusted={onTrusted} />
    </>
  );
}

type TrustDialogProps = {
  readonly open: boolean;
  readonly projectName: string;
  readonly onClose: () => void;
  readonly onTrusted: () => void;
};

function TrustDialog({ open, projectName, onClose, onTrusted }: TrustDialogProps) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const [failedCode, setFailedCode] = useState<string>();
  const trust = async () => {
    try {
      await setProjectTrust(true);
      onClose();
      onTrusted();
    } catch (error) {
      setFailedCode(error instanceof ApiError ? (error.code ?? String(error.status)) : 'network');
    }
  };
  return (
    <Dialog open={open} title={t('trust.title')} closeLabel={t('trust.close')} onClose={onClose}>
      <p className="text-ink-soft">{t('trust.intro')}</p>
      <p className="grid gap-0.5 rounded-2xl bg-field px-4 py-2.5">
        <span className="text-xs text-ink-faint">{t('trust.project')}</span>
        <span className="font-medium break-all" data-testid="trust-project">
          {projectName}
        </span>
      </p>
      <p className="pt-2 text-xs text-ink-faint">{t('trust.restricted')}</p>
      {failedCode !== undefined && (
        <p role="alert" className="text-danger">
          {errorText(tError, failedCode)}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-3">
        <button
          type="button"
          onClick={() => void trust()}
          className="h-10 rounded-full bg-sun px-5 font-medium text-ink"
        >
          {t('trust.confirm')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-full bg-field px-5 text-ink-soft"
        >
          {t('trust.later')}
        </button>
      </div>
    </Dialog>
  );
}
