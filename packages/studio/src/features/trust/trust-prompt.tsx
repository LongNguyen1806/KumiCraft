// Workspace trust in the Studio (SPEC-05 S-80, S-81, SPEC-04.1 section 6.1): an untrusted workspace
// opens in restricted mode. The first time in a tab the Studio asks; afterwards a bar stays on top.
import type { WorkspaceMeta } from '@reactcraft/model';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../api/http.ts';
import { setWorkspaceTrust } from '../../api/workspace-client.ts';
import { Dialog } from '../../components/ui/dialog.tsx';
import { errorText } from '../../routes/error-text.ts';

type Link = { readonly label: string; readonly path: string };

/** An absolute path or one going up leaves the workspace folder (S-80 warning). */
export const isOutsideWorkspace = (path: string): boolean =>
  /^([a-zA-Z]:[\\/]|[\\/]|\.\.([\\/]|$))/.test(path);

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
  readonly workspace: WorkspaceMeta;
  /** Reads the session again once the workspace is trusted. */
  readonly onTrusted: () => void;
};

/** Warning bar of restricted mode, and the trust question (shown once per tab at first). */
export function TrustPrompt({ workspace, onTrusted }: TrustPromptProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => !wasAsked(workspace.id));
  const close = () => {
    rememberAsked(workspace.id);
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
      <TrustDialog open={open} workspace={workspace} onClose={close} onTrusted={onTrusted} />
    </>
  );
}

type TrustDialogProps = TrustPromptProps & {
  readonly open: boolean;
  readonly onClose: () => void;
};

function TrustDialog({ open, workspace, onClose, onTrusted }: TrustDialogProps) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const [failedCode, setFailedCode] = useState<string>();
  const trust = async () => {
    try {
      await setWorkspaceTrust(true);
      onClose();
      onTrusted();
    } catch (error) {
      setFailedCode(error instanceof ApiError ? (error.code ?? String(error.status)) : 'network');
    }
  };
  return (
    <Dialog open={open} title={t('trust.title')} closeLabel={t('trust.close')} onClose={onClose}>
      <p className="text-ink-soft">{t('trust.intro')}</p>
      <LinkList workspace={workspace} />
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

/** The folders the workspace points to, with a warning for those outside it (S-80). */
function LinkList({ workspace }: { readonly workspace: WorkspaceMeta }) {
  const { t } = useTranslation();
  const links: Link[] = [
    ...(workspace.targetProject === undefined
      ? []
      : [{ label: t('trust.targetProject'), path: workspace.targetProject.path }]),
    ...workspace.backends.map((backend) => ({ label: backend.label, path: backend.path })),
  ];
  if (links.length === 0) return <p className="pt-2">{t('trust.noLinks')}</p>;
  return (
    <ul className="grid gap-2 pt-2" data-testid="trust-links">
      {links.map((link) => (
        <li
          key={`${link.label}:${link.path}`}
          className="grid gap-0.5 rounded-2xl bg-field px-4 py-2.5"
        >
          <span className="text-xs text-ink-faint">{link.label}</span>
          <span className="font-mono text-xs break-all">{link.path}</span>
          {isOutsideWorkspace(link.path) && (
            <span className="text-xs text-danger">{t('trust.outside')}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
