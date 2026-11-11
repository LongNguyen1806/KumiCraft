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
      className="rounded-lg border border-sun bg-sun-soft p-3 text-xs leading-relaxed text-ink flex items-start gap-2.5"
    >
      <AlertCircle className="size-4 shrink-0 text-warn mt-0.5" />
      <span>{t('lockedUntrusted')}</span>
    </div>
  );
}
