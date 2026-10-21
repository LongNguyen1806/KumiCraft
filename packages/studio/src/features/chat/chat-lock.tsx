// Lock banners for untrusted project or missing AI agent (WP-3.05a, R-CH-06).
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type ChatLockProps = {
  readonly reason: 'untrusted' | 'no-agent';
};

export function ChatLock({ reason }: ChatLockProps) {
  const { t } = useTranslation('chat');

  if (reason === 'untrusted') {
    return (
      <div
        data-testid="chat-locked-untrusted"
        className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 flex items-start gap-2.5"
      >
        <AlertCircle className="size-4 shrink-0 text-amber-600 mt-0.5" />
        <span>{t('lockedUntrusted')}</span>
      </div>
    );
  }

  return (
    <div
      data-testid="chat-locked-no-agent"
      className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 flex items-start gap-2.5"
    >
      <AlertCircle className="size-4 shrink-0 text-amber-600 mt-0.5" />
      <span>{t('lockedNoAgent')}</span>
    </div>
  );
}
