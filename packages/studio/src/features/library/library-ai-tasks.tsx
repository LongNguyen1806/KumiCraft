// "Done by AI" tiles of the Library: project-wide jobs (dark mode) that KumiCraft hands to the AI tab
// with a prepared request instead of writing them itself (owner decision 2026-11-15, QA K9.8-1).
import { Moon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Dialog } from '../../components/ui/dialog.tsx';
import { askAiWithDraft } from '../chat/ask-ai-about-element.ts';

const DARK_MODE_KEYWORDS = ['dark', 'tối', 'toi', 'theme', 'giao diện', 'night', 'ai'];

function matchesQuery(query: string, label: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return label.toLowerCase().includes(q) || DARK_MODE_KEYWORDS.some((k) => k.includes(q));
}

function DarkModeAiDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation('library');
  const { t: tCommon } = useTranslation();
  return (
    <Dialog
      open={open}
      title={t('aiTasks.darkMode.label')}
      closeLabel={tCommon('settings.close')}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4 p-5 text-xs" data-testid="library-ai-dark-mode-dialog">
        <p className="text-ink leading-relaxed">{t('aiTasks.darkMode.description')}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border-line text-ink hover:bg-field h-8 rounded-md border px-3"
          >
            {tCommon('settings.close')}
          </button>
          <button
            type="button"
            data-testid="library-ai-dark-mode-ask"
            title={tCommon('interaction.askAiHint')}
            onClick={() => {
              askAiWithDraft(tCommon('inspector.darkSetupAiPrompt'));
              onClose();
            }}
            className="bg-accent h-8 rounded-md px-3 font-medium text-white hover:opacity-90"
          >
            {tCommon('interaction.askAi')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** One section at the end of the Library; its tiles open a description, never insert code. */
export function LibraryAiTasks({ query }: { readonly query: string }) {
  const { t } = useTranslation('library');
  const [open, setOpen] = useState(false);
  const label = t('aiTasks.darkMode.label');
  if (!matchesQuery(query, label)) return undefined;

  return (
    <div className="space-y-1.5" data-testid="library-ai-tasks">
      <h3 className="text-ink-faint text-[11px] font-semibold" title={t('aiTasks.hint')}>
        {t('aiTasks.title')}
      </h3>
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          data-testid="library-ai-dark-mode"
          title={t('aiTasks.hint')}
          onClick={() => {
            setOpen(true);
          }}
          className="border-line bg-card-solid hover:border-border hover:bg-field relative flex min-w-0 flex-col items-center gap-1 rounded-[7px] border px-1 pt-5 pb-2 text-center transition-colors"
        >
          <span className="bg-accent/10 text-accent absolute top-1 right-1 rounded px-1 py-0.5 text-[9px] leading-none font-medium">
            {t('aiTasks.badge')}
          </span>
          <Moon className="text-ink-soft size-[18px]" aria-hidden />
          <span className="text-ink max-w-full text-[11px] leading-tight break-words">{label}</span>
        </button>
      </div>
      <DarkModeAiDialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </div>
  );
}
