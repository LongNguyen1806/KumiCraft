import { useTranslation } from 'react-i18next';

import { TopBar } from '../features/shell/top-bar.tsx';

type EditorScreenProps = {
  readonly version: string;
  readonly name: string;
  readonly revision: number;
};

/** State `open`. Toolbar, panels and status bar come with B4. */
export function EditorScreen({ version, name, revision }: EditorScreenProps) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col gap-2.5 px-3.5 py-3">
      <TopBar version={version} workspaceName={name} />
      <main
        className="flex-1 rounded-panel bg-card/40 shadow-soft"
        aria-label={t('editor.canvas')}
        data-testid="editor"
      />
      <footer className="flex h-[34px] items-center gap-4 rounded-full bg-card px-4 text-xs text-ink-soft shadow-soft">
        <span className="font-mono">{t('editor.revision', { revision })}</span>
      </footer>
    </div>
  );
}
