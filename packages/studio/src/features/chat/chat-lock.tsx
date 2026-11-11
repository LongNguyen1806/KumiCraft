// Lock banner for untrusted project (WP-3.05a, R-CH-06).
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type ChatLockProps = {
  readonly reason: 'untrusted';
};

export function ChatLock({ reason }: ChatLockProps) {
  const { t } = useTranslation('chat');

  return (
    <div
      data-testid={`chat-locked-${reason}`}
      className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-ink flex items-start gap-2.5"
    >
      <AlertCircle className="size-4 shrink-0 text-amber-700 mt-0.5" />
      <span>{t('lockedUntrusted')}</span>
    </div>
  );
}
